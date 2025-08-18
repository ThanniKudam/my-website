---
title: "Understanding Memory Descriptor Lists (MDLs) for Windows Vulnerability Research & Exploit Development"                                        
date: "25-01-2025"          
excerpt: "I had no idea what they were, since I had never heard of them before. I remember reading those posts multiple times (I swear!), diving through MSDN, checking a few Stack exchange pages, and eventually managing to grasp how they worked."                                                            
readTime: "7 min read"
tags: ["Windows Internals", "MDLs", "VR"]
author: "WaterBucket"
---

Understanding Memory Descriptor Lists (MDLs) for Windows Vulnerability Research & Exploit Development
=====================================================================================================

![Ik this is irrelevant but I find this funny :)](https://miro.medium.com/v2/resize:fit:1400/format:webp/0*xpy8y3EuoamZzjbF.jpg)

Long story short, I was watching a HITB conference talk on “[_A Deep Dive Into Two (Windows) Exploits Demonstrated At Pwn2Own_](https://youtu.be/d0I-UOQHCVs?feature=shared)” by Thomas Imbert ([@masthoon](https://twitter.com/masthoon)) where he demonstrated a LPE (CVE-2023–29360) found in mskssrv.sys (Microsoft Kernel Streaming Server) driver. This vulnerability was quite interesting as it’s not the typical LPE bug that we usually see. Rather, it’s _a logical bug that defeats most mitigations by allowing direct read and write access to kernel virtual memory_.

> **NOTE: I am not going to discuss the root cause analysis of this bug, as there are a couple of amazing blog posts that explain it beautifully. I will mention those posts as references at the end of this blog.**

Then, what’s this blog for? Well, that bug was primarily related to MDLs, and when I first came across those analyses, I had no idea what they were, since I had never heard of them before. I remember reading those posts multiple times (I swear!), diving through [_MSDN_](https://learn.microsoft.com/en-us/windows-hardware/drivers/kernel/using-mdls), checking a few [_Stack exchange_](https://softwareengineering.stackexchange.com/questions/389742/what-is-the-difference-between-a-page-table-entry-and-a-memory-descriptor-list) pages, and eventually managing to grasp how they worked. Even now, I don’t fully understand them, so feel free to correct me if I’m wrong at any point. That’s why I wanted to write this blog, so you won’t have to spend too much time browsing multiple forums to grasp the basics (at least enough to understand that bug). Trust me, by the end of this, you’ll have a solid overview of what MDLs are :)

What Is an MDL?
===============

An MDL (Memory Descriptor List) is a structure that describes the **physical memory pages** backing a virtual memory address (VA). Since kernel-mode drivers **_cannot directly access user-mode memory_**, the OS uses MDLs to provide the driver with a way to locate the physical memory corresponding to a user-mode buffer.

Meanwhile, It’s important for us to understand the distinction between virtual memory and physical memory. Virtual memory is always contiguous, while physical memory is non-contiguous and tends to be more fragmented. This is where MDLs come into play. MDLs are primarily used for I/O operations, where a virtual memory data buffer is locked to a specific physical address range. The MDL describes the mapping and relationship between the buffer and the physical memory addresses.

![Image taken from big-5 sec’s post](https://miro.medium.com/v2/resize:fit:858/format:webp/0*tanwGHVHcPcwXNKy.png)

> so the tl’dr is, lets say we are allocating a buffer from the user mode, the VA (Virtual Address) for the same would be pointing to some location at the physical memory but as kernel-mode drivers can’t directly access them, they creates a MDL for that user mode buffer that contains the pointers(locations) to those user mode buffer’s location in kernel mode so the driver can use this MDL to find the appropriate location of the user mode buffer in the physical memory and can use it.

Why Do We Need MDLs?
====================

The main reason is to avoid unnecessary memory copies and to be used for Direct Memory Access (DMA) operations. Let’s put it this way,

1.  **Scenario 1: Normal Memory Access (Without MDL)**

Usually, when a user-mode program sends data to a kernel driver:

*   The program allocates a buffer in user memory (VA).
*   The kernel cannot directly access this memory because it’s in user mode.
*   The typical solution is to copy the data from the user-mode buffer to a kernel-mode buffer.
*   Example: `memcpy(kernelBuffer, userBuffer, size);`

But the problem is Copying memory takes extra time and CPU resources.

2. **Scenario 2: Using MDL to Avoid Copying (Direct I/O)**

With an **MDL**, the kernel driver can **map the physical pages** of a user-mode buffer and access them directly, avoiding an extra copy:

*   The OS **already mapped** the user-mode buffer to physical pages in RAM.
*   The driver **creates an MDL** to describe the **same physical pages**.
*   The driver can now **directly access the memory** instead of copying it.

Here’s the advantage because the data is not copied; instead, both user-mode and kernel-mode components access the same physical memory.

How MDLs Work
=============

When a user-mode program allocates a buffer, the VA (virtual address) of the buffer points to some physical pages in RAM. However, the kernel cannot access this buffer directly. Here’s where MDLs come into play:

**1. Creating an MDL for a User-Mode Buffer**

When a driver receives a user-mode buffer, it needs to create an MDL:

```C
//From MSDN:
PMDL IoAllocateMdl(
  [in, optional]      __drv_aliasesMem PVOID VirtualAddress,
  [in]                ULONG                  Length,
  [in]                BOOLEAN                SecondaryBuffer,
  [in]                BOOLEAN                ChargeQuota,
  [in, out, optional] PIRP                   Irp
);
//Example Usage:
PMDL mdl = IoAllocateMdl(userBuffer, bufferSize, FALSE, FALSE, NULL);
```

This allocates an MDL structure that describes the memory layout of `userBuffer`.

**2. Locking Pages in RAM**

Before accessing the buffer, the driver must lock the pages into memory to prevent them from being swapped out:

```C
//From MSDN:
void MmProbeAndLockPages(
  [in, out] PMDL            MemoryDescriptorList,
  [in]      KPROCESSOR_MODE AccessMode,
  [in]      LOCK_OPERATION  Operation
);
//Example Usage:
MmProbeAndLockPages(mdl, UserMode, IoReadAccess);
```

This ensures that the pages backing `userBuffer` remain in RAM. The MDL now contains a list of physical page addresses corresponding to the user-mode buffer.

I hope this made some sense, if not just read the above content once again because that’s how it works!

Now, I feel it would be better to give an overview about the bug. Before that Let’s describe in what consists the _probing_: as already described, new MDLs can be created to get the physical description of a given virtual address’s buffer already in use by the OS, and potentially to directly interact with the physical memory associated with this buffer. In particular, it can be used against various data already in use at the kernel level. This is a problem when the MDL parameters come from the user-land (for instance because that user-land process aims to perform a DMA operation), for example through a `DeviceIO` control message made to a driver. Indeed, if the user-land process passes in kernel pointers for the creation of the MDL, and is then able to interact with it, that means this user-land process would be able to interact with kernel data. As a consequence, **the user/kernel barrier is broken**. To avoid this problem, the _probing_ simply checks that the buffer VA in the MDL is not in the kernel-land, by checking the address is not superior to `0x7FFFFFFF0000`.

> **But MmProbeAndLockPages() implementation in the unpatched mskssrv.sys driver, the** `**AccessMode**` **parameter was not correctly set to** `**UserMode**`**, so no probing of the MDL occurs. As a consequence, the user can create a MDL pointing to critical kernel data.**

Basically the general rule to set the AccessMode parameter is

*   If the buffer comes from user-mode memory → use `UserMode`.
*   If the buffer comes from kernel-mode memory → use `KernelMode`.
*   DO NOT mix them up, or you’ll crash the system or it would create a bug like we are seeing now but as always it depends on the configuration.

MDLs are interesting, as improper handling can lead to vulnerabilities. If you are reversing a driver that utilizes MDLs, you can look for

1. Double Mapping Issues (Time-of-Check to Time-of-Use — TOCTOU)

*   Since an MDL allows **both user-mode and kernel-mode to access the same memory**, an attacker can modify the contents **after the kernel has validated them but before they are used**.
*   Example: If a kernel driver reads a structure from a user buffer, an attacker can **change the values after validation**, leading to security flaws.

2. Incorrect Access Mode in `MmProbeAndLockPages()`

*   If a driver incorrectly uses `KernelMode` instead of `UserMode` while locking pages, it can cause invalid memory access and system crashes **(BSODs)**
*   This can be abused for Denial of Service (DoS) attacks or elevation of privilege

3. Use-After-Free (UAF) with MDLs

*   If an MDL is not properly freed (`IoFreeMdl()`), or if an attacker finds a way to free the original user-mode buffer but keep the MDL active, it could lead to UAF bugs.
*   Exploiting this could allow an attacker to hijack the freed memory and trick the driver into accessing it.

Of course, there may be many other primitives beyond this. I’m far from calling myself a vulnerability researcher , I still have a lot to learn and explore. These are just some of the primitives I came across while reading other blogs, and I’m always grateful to the authors who take the time to document the root cause analysis of the bugs they discover.

That’s all for now! Hope you guys find this post interesting and useful. Follow me on [LinkedIn](https://www.linkedin.com/in/dharani-sanjaiy-/), [Medium](https://medium.com/@WaterBucket), [X](https://x.com/DharaniSanjaiy).

_PEACE!_

REFERENCES:
-----------

[A look at CVE-2023-29360, a beautiful logical LPE vuln
------------------------------------------------------

### an analysis of the root cause of this vulnerability, where MDLs are in play

big5-sec.github.io](https://big5-sec.github.io/posts/CVE-2023-29360-analysis/?source=post_page-----7de8729caee7---------------------------------------)

[GitHub - Nero22k/cve-2023-29360: Exploit for CVE-2023-29360 targeting MSKSSRV.SYS driver
----------------------------------------------------------------------------------------

### Exploit for CVE-2023-29360 targeting MSKSSRV.SYS driver - Nero22k/cve-2023-29360

github.com](https://github.com/Nero22k/cve-2023-29360?source=post_page-----7de8729caee7---------------------------------------)

[Critically close to zero (day): Exploiting Microsoft Kernel streaming service
-----------------------------------------------------------------------------

### Microsoft recently found and patched a vulnerability in the Microsoft Kernel streaming service. Learn more here.

securityintelligence.com](https://securityintelligence.com/x-force/critically-close-to-zero-day-exploiting-microsoft-kernel-streaming-service/?source=post_page-----7de8729caee7---------------------------------------)

[mskssrv.sys - CVE-2023-29360 | Researchs
----------------------------------------

### Bug CVE : CVE-2023-29360 Bug type : Logical bug leading to LPE Integrity needed : Medium for kernel address leak Tested…

seg-fault.gitbook.io](https://seg-fault.gitbook.io/researchs/windows-security-research/exploit-development/mskssrv.sys-cve-2023-29360?source=post_page-----7de8729caee7---------------------------------------)

[Chaining N-days to Compromise All: Part 3 — Windows Driver LPE: Medium to System
--------------------------------------------------------------------------------

### We will present how we elevate the privilege from user to SYSTEM to chain the vulnerability of VMWare. The…

blog.theori.io](https://blog.theori.io/chaining-n-days-to-compromise-all-part-3-windows-driver-lpe-medium-to-system-12f7821d97bb?source=post_page-----7de8729caee7---------------------------------------)
