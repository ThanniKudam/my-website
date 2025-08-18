---
title: "Understanding Path Resolution in Windows"
date: "2025-07-20"  
excerpt: "Understanding Path Resolution in Windows for Vulberability Research & Exploit Development.. Going beyong the traditional content :)"
readTime: "10 min read"
tags: ["windows paths", "Vulnerability Research", "Windows Internals"]
author: "WaterBucket"
---

**Understanding Path Resolution in Windows**
============================================

![captionless image](https://miro.medium.com/v2/resize:fit:1400/format:webp/0*cl-2covByWJ473QF)

⚠️ Note:
This post is debugger-heavy and dives deep into NT path resolution internals, symbolic links, and kernel object namespaces. We’ll be using WinDbg, NT-native APIs, and internal structures like `_OBJECT_ATTRIBUTES`, `UNICODE_STRING`, and the `Object Manager` in kernel mode.

If you’re not comfortable with Windows kernel debugging yet, I recommend brushing up on:

*   Basic use of WinDbg (`.symfix`, `bp`, `dt`, `du`, `!object`, etc.)
*   Familiarity with `ntdll.dll` and syscall transitions
*   Understanding of kernel data structures like `OBJECT_DIRECTORY` and `OBJECT_SYMBOLIC_LINK`

Well, if you don’t know any of these, I suggest reading it a couple of times to understand the concepts. :)

Hey everyone! Hope you’re all doing well. This is another follow-up post in the series “Understanding Windows Internals for Vulnerability Research & Exploit Development.” We’re going to talk about path resolution in Windows, something we’ve all encountered many times, whether reversing a driver or looking for a “legit” pipe to copy during C2 SMB beacon setup. If you’ve guessed it, yes, we are discussing path resolution. I mean, I’ve done `ls \\.\pipe\` many times while setting up my SMB listener but never bothered to understand it. Or while reversing a driver, I’ve seen `\??\C:\temp\hello.txt` numerous times, but what’s that `??` for? I guess you get the point.

Well, When a user-mode program on Windows calls a function like `CreateFileW(L"C:\temp\hello.txt", ...)`, the assumption is that the system simply locates the file on disk and opens it. But that’s far from the full story. Internally, Windows interprets this file path by translating it into a kernel-level object resolution process involving multiple subsystems.. the Win32 API layer, ntdll, the Object Manager, the I/O Manager, and potentially filesystem or device drivers. To actually understand how this happens, we need to leave simplified version of filesystem paths and explore the **NT object namespace**, the `??` directory, symbolic link resolution, and how device paths are parsed deep in kernel mode.

Win32 Paths and Their Conversion to NT Paths
============================================

I hope most of y’all are aware of how win32 APIs gets dispatched to kernel mode.. If not, the TL;DR is When a function like `CreateFileW` is called, it first goes through the Windows user-mode API in `kernel32.dll`, which eventually dispatches to the lower-level system call wrapper in `ntdll.dll`. There, the function `NtCreateFile` is invoked.

![captionless image](https://miro.medium.com/v2/format:webp/0*wSUaLKpEOGs7ZpVY.png)

At this point, the path `C:\temp\hello.txt` (This is the example path that we will be using across this post) has already been translated into an **NT-style path** something like `??\C:\temp\hello.txt`. This translation is crucial: Win32 paths are **not** used inside the kernel. Instead, Windows uses the **NT Object Manager namespace**, which is a hierarchical structure representing kernel objects like devices, drivers, symbolic links, mutexes, and filesystems.

The `??` prefix is particularly important. This directory inside the NT object namespace acts as the redirection point for user-mode file access. Internally, `??` is a symbolic link itself, which typically resolves to `\GLOBAL??`. You can observe this in WinDbg with the following command:

```C
kd> !object \??\
Object: fffff8024e2a4020  Type: (fffff8024d878500) Directory
    ObjectHeader: fffff8024e2a3ff0 (new version)
    Name: \??\
    Contains:
        SymbolicLink     C: -> \Device\HarddiskVolume1
        SymbolicLink     PhysicalDrive0 -> \Device\Harddisk0\DR0
        Directory        GLOBALROOT
        Directory        Pipe
        Directory        UNC
```

This shows that the `C:` drive, as seen by the user, is actually a symbolic link to `\Device\HarddiskVolume1`. Similarly, `PhysicalDrive0` maps to `\Device\Harddisk0\DR0`, and various system-defined directories like `GLOBALROOT`, `Pipe`, and `UNC` exist under the same namespace. Every time a Win32 process refers to a DOS-style path, the Object Manager begins resolving it from this namespace — starting at `??`.

Some Debugger tracing coz we all love it, Aren’t we?
====================================================

Let’s create a simple usermode program that calls CreateFileW:

```C
#include <Windows.h>
#include <stdio.h>
int main() {
    HANDLE h = CreateFileW(L"C:\\temp\\hello.txt", GENERIC_READ, FILE_SHARE_READ, NULL, OPEN_EXISTING, 0, NULL);
    if (h != INVALID_HANDLE_VALUE) {
        printf("Opened file successfully.\n");
        CloseHandle(h);
    } else {
        printf("Failed: %lu\n", GetLastError());
    }
    return 0;
}
```

Now attach WinDbg to the process and break on `NtCreateFile` (which is the syscall eventually called by `CreateFileW`). Again, for setting up debugger and stufss, there are already a ton of posts and videos so refer to them.. You can set a breakpoint like this:

```C
kd> bp nt!NtCreateFile
```

Once the breakpoint is hit, inspect the second argument (usually `rdx` on x64) which is a pointer to the `_OBJECT_ATTRIBUTES` structure:

```C
kd> dt _OBJECT_ATTRIBUTES @rdx
+0x000 Length           : 0x30
+0x008 RootDirectory    : (null)
+0x010 ObjectName       : 0xffffc7818ab3f4e0 -> UNICODE_STRING "\??\C:\temp\hello.txt"
+0x018 Attributes       : 0x40
```

You can dereference and print the NT path like this:

```C
kd> du poi(@rdx+0x10)
00000000`ffffc781`8ab3f4e0  "\??\C:\temp\hello.txt"
```

This clearly confirms that by the time execution reaches the kernel, the familiar Win32 path has already been transformed into an NT-style path, rooted at `??`.

Object Manager and Symbolic Link Resolution
===========================================

The kernel now begins resolving this path through the Object Manager using `ObOpenObjectByName`, which internally invokes `ObpLookupObjectName`. This is the engine that walks the NT object namespace. It handles tokenization of the path string, segment by segment, beginning at the root directory (`??`) and walking down each level: first `C:`, then `temp`, and finally `hello.txt`.

Each segment of the path is checked in turn. When `ObpLookupObjectName` encounters the `C:` portion, it sees that it’s a symbolic link object. It then calls `ObpParseSymbolicLink`, which reads the target of the symlink (`\Device\HarddiskVolume1`) and restarts the name resolution process from this new path. Symbolic links in the NT namespace are kernel-mode objects of type `SymbolicLink`, and their contents, the target path are stored in an embedded `UNICODE_STRING`. This allows symbolic links to act like filesystem junctions, but they work entirely at the object namespace level and can redirect access to any kernel-visible object path.

Also, if you guys are not aware of.. The kernel path resolution mechanism is recursive. Each time a symbolic link is resolved, the new path is passed back into `[ObpLookupObjectName](https://doxygen.reactos.org/d2/de7/obname_8c_source.html)` from scratch. If the new path also begins with `??`, or points to another symbolic link (e.g., `\Device\Volume{GUID}`), the process repeats. There is a maximum symbolic link depth to prevent infinite recursion, but in practice, 3–5 levels of indirection are quite common.

[ _Heavy on IOCTLs, Dispatch routines. Refer to my other blog post on IOCTLs to understand it :)_ ] There is another important layer after `ObpLookupObjectName` has resolved the target device object namely, the I/O manager. At this point, `IoCreateFile` and `IopParseDevice` take over. These routines are responsible for determining whether the resolved object is a valid file system or device node, and they invoke the corresponding driver dispatch routines (`IRP_MJ_CREATE`) if a match is found. If the resolved object is a file system volume, the remaining components of the path (`\temp\hello.txt`) are passed to the file system driver (e.g., NTFS, FAT, ReFS) for further parsing at the FS level.

Well, There’s a work around as usual!
=====================================

It’s also possible to bypass this entire redirection structure and open objects directly using their true NT paths. For instance, you can write a userland program using `NtCreateFile` (instead of `CreateFileW`) and supply a path like `\Device\HarddiskVolume1\temp\hello.txt`. In this case, the parser starts directly from the device object, and `??` or `\GLOBAL??` are never involved. This kind of raw access is useful for sandbox testing, driver validation, and creating scenarios that intentionally bypass Win32 path logic.

Another lesser-known trick is to use the `\?` and `\.` path prefixes. In Win32, `\?` disables path normalization, allowing you to pass long paths and device syntax without canonicalization. For instance, `\?\C:\temp..\Windows\System32` is treated as-is & the `..` will not be collapsed. Internally, `\?\C:...` maps to `??\C:...`. Similarly, `\.` is commonly used for device access for example, `\.\PhysicalDrive0` translates to `??\PhysicalDrive0`, which resolves to `\Device\Harddisk0\DR0`.

![captionless image](https://miro.medium.com/v2/format:webp/0*jdeTKmOzKW6-auM-.gif)

Understanding `??` and `\GLOBAL??`
====================================

The `??` namespace is a per-session or per-process symbolic link that provides a redirection mechanism for user-mode to kernel-mode path translation. Historically, this was tied to the concept of a process' "DOS devices directory." By default, `??` is itself a symbolic link to the global namespace `\GLOBAL??`, although this can be session-specific in Terminal Server environments. We can confirm this by using WinDbg:

```C
kd> !object \??
Object: ffff9d0a9ba5b9e0  Type: (ffff9d0a9956a800) SymbolicLink
    ObjectHeader: ffff9d0a9ba5b9b0 (new version)
    Name: \??
    Target String: \GLOBAL??
```

This symbolic link allows `??\C:` to resolve to `\GLOBAL??\C:`, and in turn that resolves to an actual volume device object such as `\Device\HarddiskVolume1`. The separation of namespaces allows for flexibility: for example, sandboxed environments or remote sessions can have custom `??` namespaces that differ from the system-wide `\GLOBAL??` mappings. The `\GLOBAL??` directory is a real `OBJECT_DIRECTORY` that contains symbolic links for DOS devices across the entire system. We can inspect its contents:

```C
kd> !object \GLOBAL??
Object: ffff9d0a9baf30e0  Type: (ffff9d0a9956a500) Directory
    ObjectHeader: ffff9d0a9baf30b0 (new version)
    Name: \GLOBAL??
Contains:
        SymbolicLink     C: -> \Device\HarddiskVolume1
        SymbolicLink     PhysicalDrive0 -> \Device\Harddisk0\DR0
        SymbolicLink     NUL -> \Device\Null
        SymbolicLink     CON -> \Device\ConDrv\Console
```

Each of these entries is a `OBJECT_SYMBOLIC_LINK` structure pointing to a `UNICODE_STRING` that defines its target. When the kernel resolves `??\C:\temp\file.txt`, the lookup chain is: `??` (symlink) → `\GLOBAL??` (directory) → `C:` (symlink) → `\Device\HarddiskVolume1` (device) → FS driver parsing of `\temp\file.txt`.

Internal Structure of OBJECT_DIRECTORY
---------------------------------------

The directories like `\GLOBAL??` or `\Device` are backed in memory by a structure called `_OBJECT_DIRECTORY`. This structure is a hash table of object name entries that point to actual object headers. These are walkable in kernel memory with WinDbg.. You can dump the contents of an object directory using:

```C
kd> !dir \GLOBAL??
```

Each object in the directory is an instance of `_OBJECT_HEADER`, which wraps the real object (like a symbolic link or device object) with metadata including reference counts, names, type pointers, and security descriptors. The structure is defined more or less like this:

```C
typedef struct _OBJECT_HEADER {
    LONG_PTR PointerCount;
    LONG_PTR HandleCount;
    POBJECT_TYPE Type;
    PVOID NameInfoOffset;
    PVOID QuotaInfoOffset;
    PVOID SecurityDescriptor;
    // ... more internal fields
} OBJECT_HEADER, *POBJECT_HEADER;
//For full struct, refer this https://www.vergiliusproject.com/kernels/x64/windows-10/1903/_OBJECT_HEADER
```

Session-Aware `??` Namespace Behavior
--------------------------------------

This is something I found interesting while reading about path redirections. In multi-user Windows systems, `??` is not always globally consistent. Each session may have its own `??` object directory that overlays the global one. This is session-aware redirection, which means that symbolic links in session 0 (services, system processes) may differ from those in a user session (interactive logon). You can observe this via:

```C
kd> !object \Sessions\0\DosDevices\00000002
```

This resolves the `??` namespace for a specific logon session. If a process in that session opens `C:`, it follows the symbolic link inside that per-session `??`, not the system-wide one.

This can result in broken assumptions when a kernel-mode component expects that all user-space `??` mappings are globally consistent. For example, if a driver attempts to parse a path passed from user-mode under the assumption that `??\C:` always points to `\Device\HarddiskVolumeX`, it might be misled when the session-local namespace says otherwise.

\GLOBALROOT as an Escape Hatch
-------------------------------

A particularly under-documented behavior which I found missing in other docs is the use of the `??\GLOBALROOT` prefix. This serves as a way to escape the current `??` mapping and access the raw namespace starting at the true NT root ``. For example:

```C
\??\GLOBALROOT\Device\HarddiskVolume1\Windows\System32
```

This bypasses any remapped `C:` drive, sandboxed namespace, or `??`-level symbolic links. It is often used by security tools, AVs, and EDRs to access the file system in a consistent and non-remapped manner. However, this behavior also provides a mechanism for bypassing some of the user-space-level containment or redirection strategies — especially in sandbox or virtualization scenarios.

This technique is exploitable when a driver blindly trusts user-supplied paths, assuming that `??`-prefixed strings are restricted by user-mode mapping. In reality, a user can specify a `GLOBALROOT`-based path to access devices or file systems outside the intended scope.

Inconsistencies, Edge Cases, and Broken Assumptions in Device Path Resolution
=============================================================================

Relative Paths and Ambiguity in Filesystem Drivers
--------------------------------------------------

Another underexplored inconsistency arises with relative path resolution. Suppose `CreateFileW("C:\temp..\Windows\System32")` is invoked with a `??\C:` mapping that points to `\Device\HarddiskVolume1`. The resolution process will hand off the full subpath to the file system driver (e.g., NTFS). That file system is then responsible for resolving `temp..\Windows\System32`, including normalization.

But if the same call is made using `\?\C:\temp..\Windows\System32`, the normalization step is skipped in user-mode. The raw path `??\C:\temp..\Windows\System32` is sent into the kernel, and normalization is now left entirely to NTFS. This difference in behavior creates subtle inconsistencies — for example, junctions, reparse points, or symbolic links might behave differently depending on how the path was normalized.

Additionally, some filesystem drivers don’t handle reparse tags and normalization consistently, especially third-party FS or network redirectors. They may incorrectly interpret `..` segments or fail to collapse path components, leading to access outside of the intended directory boundaries.

Incomplete Cleanup and Ghost Entries
------------------------------------

Because symbolic links and device objects persist until explicitly deleted or until reference counts go to zero, developers who fail to clean up properly during unload routines can leave orphaned or ghost mappings inside `\GLOBAL??` or `\Device`. This can result in stale symbolic links that point to deleted objects, which cause `STATUS_OBJECT_NAME_NOT_FOUND` or `STATUS_INVALID_HANDLE` errors.

You can detect these using:

```C
kd> !object \GLOBAL??\MyDummyDevice
```

If the object doesn’t exist anymore but the link does, it means cleanup failed. In production environments, such inconsistencies can persist until reboot.

Conclusion
==========

In this post, I just wanted to give an understanding on its internals rather than directly showing/talking about its exploitation or such.. So, Maybe in the future I’ll write on Exploiting Path Resolution Flaws such as Namespace Confusion, Symlink Tricks, and Device Hijacks.. I’m still exploring these areas and honestly, I haven’t come across any CVEs that are solely related to these which I could give as reference.. So, if you guys come across any, feel free to text me..

As I always mention in my posts, there may be many other primitives beyond this. I’m far from calling myself a vulnerability researcher , I still have a lot to learn and explore. These are just some of the primitives I came across while reading other blogs, and I’m always grateful to the authors who take the time to document the root cause analysis of the bugs they discover.

That’s all for now! Hope you guys find this post interesting and useful. Follow me on [LinkedIn](https://www.linkedin.com/in/dharani-sanjaiy-/), [Medium](https://medium.com/@WaterBucket), [X](https://x.com/DharaniSanjaiy).

_PEACE!_
