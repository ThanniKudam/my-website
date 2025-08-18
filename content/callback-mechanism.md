---
title: "Understanding Callback Registration Mechanisms in Windows"                                        
date: "03-03-2025"          
excerpt: "This blog post is on Callback Registration Mechanisms, where we will be talking more about its internals rather than just covering the already well-known callback routines."                               readTime: "8 min read"
tags: ["Windows Internals", "VR", "Exploit Dev"]
author: "WaterBucket"
---

Understanding Callback Registration Mechanisms in Windows
=========================================================


![Me core!](https://miro.medium.com/v2/resize:fit:1400/format:webp/0*hPqLt3SeWT8l6WLM.jpg)

Hey everyone! Hope you’re all doing well. This is another follow up post in the series “Understanding windows internals for vulnerability research & exploit development”. This blog post is on Callback Registration Mechanisms, where we will be talking more about its internals rather than just covering the already well-known callback routines. Majority of this blog’s content goes beyond the typical **_PsSetXxxNotifyRoutines_** , which you might have come across a ton of times if you're exploring malware development or Windows-related stuffs in general. Hope it would be useful!

**So, What are Windows Callbacks?**
-----------------------------------

Well, Windows provides numerous callback registration mechanisms, allowing kernel-mode components to be notified of system events such as process creation, thread termination, registry modifications, and image loading. Basically, Callbacks are like Notifications but instead of just letting you know that something has happened, it **executes a function you provided**, giving you context like which process was created, what thread exited, what registry key was modified etc etc.

![Thanks to ChatGPT!](https://miro.medium.com/v2/resize:fit:1400/format:webp/0*qI4CTM6aYbfRCN3_)

Talking about its infrastructure, Callback systems in Windows kernel are generally implemented using lists of registered callback routines that are stored and managed internally. When an event of interest occurs (e.g., a process is created or a registry key is modified), the kernel iterates through these lists and invokes each callback in turn. These mechanisms are often exported through functions like [_ObRegisterCallbacks_](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/wdm/nf-wdm-obregistercallbacks), [_CmRegisterCallbackEx_](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/wdm/nf-wdm-cmregistercallbackex), [_IoRegisterBootDriverCallback_](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/ntddk/nf-ntddk-ioregisterbootdrivercallback), [_ExCreateCallback_](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/wdm/nf-wdm-excreatecallback) / [_ExRegisterCallback_](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/wdm/nf-wdm-exregistercallback), [_KeRegisterBugCheckCallback_](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/wdm/nf-wdm-keregisterbugcheckcallback), [_SeRegisterLogonSessionTerminatedRoutine_](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/ntifs/nf-ntifs-seregisterlogonsessionterminatedroutine) _etc.._ Each of these is tied to a specific subsystem and has unique structures and internal flows that govern its behaviour. We will go through those Functions later.

Callback Registrations
----------------------

Before going through the Data Structures and Internals related to Callbacks, First let’s talk about some of those register functions as we will be using them repeatedly going further.

1.  **_ObRegisterCallbacks_**: Object Manager Notification

This function allows kernel-mode components to register callbacks for operations on handles to specific object types (e.g., processes and threads). You might have seen this if you have ever read about the working of EDRs where they use it to monitor or block certain operations.

```C
typedef struct _OB_CALLBACK_ENTRY {
  LIST_ENTRY               CallbackListEntry;
  OB_OPERATION             Operations;
  POB_PRE_OPERATION_CALLBACK PreOperation;
  POB_POST_OPERATION_CALLBACK PostOperation;
  ...
} OB_CALLBACK_ENTRY, *POB_CALLBACK_ENTRY;
```

*   Underlying mechanism relies on _OBJECT_TYPE_INITIALIZER.Callbacks_ field for each object type.
*   Upon registration, Windows creates a **_OB_CALLBACK_ENTRY_** structure and links it into the object type’s callback list.
*   Uses _OB_OPERATION_REGISTRATION_ to specify operations (e.g., _OB_OPERATION_HANDLE_CREATE_, _OB_OPERATION_HANDLE_DUPLICATE_).

Callback entries are stored in a doubly linked list associated with each object type. On each handle operation, the kernel iterates through the list and invokes the pre/post callback functions as required.

2. **CmRegisterCallbackEx**: Registry Filtering

This function allows a driver to monitor and filter registry operations. Internally, Windows maintains a list of _CM_CALLBACK_CONTEXT_BLOCK_ entries. Upon registration, a _CM_CALLBACK_CONTEXT_BLOCK_ is created and inserted into the global list CmpCallBackVector. The list is processed during registry operations like create, set, delete, query, etc. The kernel invokes callbacks by walking through the list in CmCallback routine.

```C
typedef struct _CM_CALLBACK_CONTEXT_BLOCK {
  LIST_ENTRY ListEntry;
  PCMP_CALLBACK_ROUTINE Function;
  PVOID Context;
  UNICODE_STRING Altitude;
  ...
} CM_CALLBACK_CONTEXT_BLOCK, *PCM_CALLBACK_CONTEXT_BLOCK;
```

Here, Callback can be invoked at both pre and post notification stages. It uses altitude string ordering, similar to _ObRegisterCallbacks_ and the unregistration is done via _CmUnRegisterCallback_ function.

> You might have noticed most of these callback systems use altitude strings to define the execution order.. If you guys have read my previous post, at this point you should be aware of it but anyways.. Long story short, Altitudes are sorted in descending order, Used to determine priority of execution (e.g., AV drivers get higher altitudes) & Altitudes must be globally unique per callback system (enforced via string comparison).

This system allows multiple vendors to hook into the same event without explicit registration coordination.

3. **KeRegisterBugCheckCallback:** This is an interesting function which is used to register callbacks that are executed during a system crash (bugcheck).

```C
typedef struct _KBUGCHECK_CALLBACK_RECORD {
  LIST_ENTRY Entry;
  PKBUGCHECK_CALLBACK_ROUTINE CallbackRoutine;
  PVOID Buffer;
  ULONG Length;
  ...
} KBUGCHECK_CALLBACK_RECORD, *PKBUGCHECK_CALLBACK_RECORD;
```

Here, Each registration creates a **_KBUGCHECK_CALLBACK_RECORD_**, which is added to a global list. List is traversed in _KeBugCheck2_ before halting the system. These callbacks must be carefully written: IRQL is high, and only non-paged memory can be accessed.

There are a ton of such callback register functions.. Each has its unique type definitions and working principles. I can’t put together all of those here so leaving it up to you guys to explore.. Just wanted to give you guys an idea about these because it would be helpful in understanding its structures later.

Callback Data Structures and Allocations..
------------------------------------------

If we add up more technical details to the above mentioned content, its infrastructure would consists of these,

*   **Linked lists** (typically doubly-linked) for managing multiple callback entries.
*   **Reference-counted** objects to handle dynamic load/unload of drivers.
*   **Altitudes** (in specific systems) to maintain execution priority.

Each registration inserts a structure (e.g., _OB_CALLBACK_ENTRY_, _CM_CALLBACK_CONTEXT_BLOCK_) into a global or per-type list. These structures contain function pointers, context data, flags, and metadata for controlling invocation and de-registration.

> Here if you are wondering what I meant by “**registrations”**, well When a driver wants to leverage a callback to obtain information about process, thread, or desktop object handle requests, whether they be handle duplication or creation events, they register that callback through one of the functions that I’ve listed at the beginning.

Memory for these structures is allocated using **_ExAllocatePoolWithTag_**, usually from the **NonPagedPoolNx**, as callbacks may be invoked at IRQL >= DISPATCH_LEVEL where paged memory access is invalid. An Example from object callbacks:

```C
entry = (POB_CALLBACK_ENTRY)ExAllocatePoolWithTag(NonPagedPoolNx, sizeof(OB_CALLBACK_ENTRY), 'cCbO');
```

Next steps would be, Once the callback structure is created and populated, it is inserted into an internal list. This is almost always protected by a **synchronization primitives:**

1.  _EX_PUSH_LOCK_ for shared/exclusive locking.
2.  _KSPIN_LOCK_ for IRQL-sensitive paths. (_Again, I’ve explained about IRQLs in the Understanding IOCTLS blog_)
3.  _FAST_MUTEX_ in legacy systems.

The insertion process involves acquiring the lock, walking the list to determine insertion point (for ordered lists), and updating forward/backward links.

In callback systems that use altitudes (e.g., _CmRegisterCallbackEx_, _ObRegisterCallbacks_), the insertion point is determined by lexicographical comparison of altitude strings:

```C
if (RtlCompareUnicodeString(&newEntry->Altitude, &current->Altitude, TRUE) < 0)
    break; // Insert before current
```

This approach ensures deterministic execution order, even with multiple third-party drivers hooking the same event.

Invocation of Callbacks occurs When a system event occurs (e.g., process creation, registry key modification), the kernel invokes all registered callbacks in a controlled loop. Internally, the flow looks like this:

```C
AcquireLock();
for (entry in CallbackList) {
    if (entry is valid && not disabled)
        entry->CallbackFunction(eventData, entry->Context);
}
ReleaseLock();
```

Some of the key concerns during invocations that you should be aware of are,

1.  **Exception handling**: Callbacks are third-party code, so they are typically wrapped with __try/__except or similar structured exception handling to prevent crashes.
2.  **IRQL correctness**: Callbacks must obey IRQL constraints; some are called at PASSIVE_LEVEL, others at DISPATCH_LEVEL or higher.
3.  **Reentrancy**: Some callback systems are non-reentrant; invoking registration/unregistration within callbacks is discouraged.
4.  **Synchronization**: Access to shared structures must be lock-protected.

Talking about **Context and State Management**, Most callback mechanisms allow a **_PVOID Context_** to be passed during registration. This is opaque to the kernel and is simply forwarded to the callback function on every invocation. This enables drivers to store per-callback state (e.g., filter rules, statistics, configuration). Additionally, flags are often used to control callback behaviors such as Enable/disable specific operations (e.g., pre-op, post-op), Enforce filtering logic & Mark callback as one-time or persistent. Example would be something like this

```C
typedef struct _MY_CALLBACK_ENTRY {
  LIST_ENTRY ListEntry;
  PVOID Context;
  BOOLEAN IsEnabled;
  ULONG Flags;
  CALLBACK_ROUTINE Function;
} MY_CALLBACK_ENTRY;
```

FYI, Some systems (e.g., object callbacks) support runtime enabling/disabling via helper APIs, which manipulate these flags.

Finally comes the De-registration and Cleanup.. When a driver is unloaded or no longer wishes to receive notifications, it must unregister its callback. This process must be done carefully:

1.  Acquire lock protecting the callback list.
2.  Locate and remove the entry.
3.  Decrement reference count (if applicable).
4.  Free allocated memory (e.g., via ExFreePoolWithTag).

In some systems, the kernel delays freeing the memory until it confirms no threads are currently invoking that callback.

Race conditions during unregistration are a frequent source of use-after-free (UAF) vulnerabilities if not handled correctly. Some mechanisms use a deferred deletion queue or a Rundown Protection object (like _EX_RUNDOWN_REF_) to handle safe removal.

Callback-Related Vulnerability Classes :)
-----------------------------------------

> **Disclaimer**: The bug classes that I’ve mentioned here are the ones that I am aware of.. There might be other classes too so if you feel something is missing feel free to DM, I’ll update it accordingly!

1.  **Use-After-Free (UAF)**: Callback still invoked after the associated driver or context is unloaded.
2.  **Race Conditions**: Inadequate synchronization during deregistration or dynamic replacement.
3.  **Dangling Pointers**: Improper handling of teardown logic or manual unregistration.
4.  **Abuse of Global Lists**: Callbacks stored in global, unprotected lists accessed without proper locking.
5.  **Bypassing Integrity Mechanisms**: Callbacks registered from unsigned or partially trusted code.

Other than this, I feel like improper handling of **callback lifetime** has been overlooked by many researchers.. I mean, Let’s say we have this pattern

```C
PsSetLoadImageNotifyRoutine(MyCallback);
```

Here, If _MyCallback_ resides in a driver that is later unloaded, and no matching _PsRemoveLoadImageNotifyRoutine_ is called:

1.  The kernel continues to call into freed memory.
2.  On modern systems, this typically results in a bugcheck (_IRQL_NOT_LESS_OR_EQUAL_ or _KMODE_EXCEPTION_NOT_HANDLED_).
3.  On older systems or with deliberate memory reuse, it can lead to **UAF exploitation**.

**Windows Defender’s Callback Telemetry as Detection Vector ^_^**

Microsoft Defender uses kernel callback tracking to detect suspicious behavior:

*   It monitors registration patterns for common abuse targets (e.g., _PsSetXxxNotifyRoutines_).
*   Detects drivers that register callbacks and unload themselves (a typical sign of stealth loaders).
*   Logs high-frequency callback invocations from suspicious sources.

This means from a vulnerability research standpoint:

*   Callbacks serve not only as an attack vector but also as a **detection surface**.
*   Fuzzing or analysis tools must mimic real drivers to avoid interference from security software.

You guys might get a better understanding of these when you try to implement such callbacks in your project.. I mean, go ahead and write a simple driver using these functions.. If you are too lazy to write one, My friend [Monish](https://x.com/m0n1x90) has recently started writing an [OpenSource EDR](https://github.com/m0n1x90/vettaiyan) which now has the capability to detect such callbacks so feel free to read the code.. That’s all for now! Hope you guys find this post interesting and useful.

Follow me on [LinkedIn](https://www.linkedin.com/in/dharani-sanjaiy-/), [Medium](https://medium.com/@WaterBucket), [X](https://x.com/DharaniSanjaiy).

_PEACE!_

REFERENCES:
===========

[Understanding Telemetry: Kernel Callbacks
-----------------------------------------

### Introduction

jsecurity101.medium.com](https://jsecurity101.medium.com/understanding-telemetry-kernel-callbacks-1a97cfcb8fb3?source=post_page-----ad3eaa6ec551---------------------------------------)

[GitHub - m0n1x90/vettaiyan: Developing an open source Windows EDR written in C & C++
------------------------------------------------------------------------------------

### Developing an open source Windows EDR written in C & C++ - m0n1x90/vettaiyan

github.com](https://github.com/m0n1x90/vettaiyan?source=post_page-----ad3eaa6ec551---------------------------------------)

[Home - Vettaiyan
----------------

### Vettaiyan - An open source EDR

vettaiyan.m0n1x90.dev](https://vettaiyan.m0n1x90.dev/?source=post_page-----ad3eaa6ec551---------------------------------------)

[https://learn.microsoft.com/en-us/windows-hardware/drivers/kernel/callback-objects](https://learn.microsoft.com/en-us/windows-hardware/drivers/kernel/callback-objects)
