---
title: "Understanding Deferred Procedure Calls (DPCs) for Windows Vulnerability Research & Exploit Development"                                        
date: "02-02-2025"          
excerpt: "DPCs are a mechanism that allows code running at a high interrupt request level (IRQL) to defer execution of lower-priority work until the processor returns to a lower IRQL."                              readTime: "7 min read"
tags: ["Windows Internals", "DPCs", "VR"]
author: "WaterBucket"
---

Understanding Deferred Procedure Calls (DPCs) for Windows Vulnerability Research & Exploit Development
======================================================================================================


![^ Me when reading Windows Internals 7th Edition. Trust me, they’re happy tears :)](https://miro.medium.com/v2/resize:fit:1400/format:webp/0*NNvdV2AXAB39tIgF.jpg)

Hey all, this is me once again with another interesting niche topic related to Windows internals. Again, I couldn’t find any blog posts other than the documentation from MSDN, so guess what? I wrote one. I can hear you screaming, ‘Dude, what the heck? Where is he getting these blog ideas from?’ Well, it was quite random, honestly. I was watching an OffByOneSecurity stream where Connor McGarr was mentioning IRQLs. I googled it, and guess what? I landed on a four-year-old Stack Overflow page where someone was complaining that they were having hard time understanding DPCs and IRQLs. That’s when I started reading about them, and here’s the post based on what I’ve learned.

![Poor guy, no one responded to him so there’s no point of sharing a link for that post](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*6MapM2Q7jqHNLVKnzQfw_g.png)

So, What Are Deferred Procedure Calls (DPCs)?
=============================================

DPCs are a mechanism that allows code running at a high interrupt request level (IRQL) to defer execution of lower-priority work until the processor returns to a lower IRQL. This helps ensure that interrupt handling remains fast and does not block other crucial system tasks.

DPCs run at IRQL `DISPATCH_LEVEL`, which is above normal thread execution but below hardware interrupts. This means that once a DPC is scheduled, it preempts normal thread execution but still allows hardware interrupts to occur.

> LOL, I know you didn’t get the above definition. You could see I’ve used the terms “IRQL” & “Interupt Handling” which you might not aware of.. so let’s talk about them first. Once you get those then understanding DPCs would be easy.

IRQLs (Interrupt Request Levels) determine the priority of operations in Windows. When the processor runs at a specific IRQL, only higher-priority tasks can interrupt it. This ensures critical system functions aren’t disrupted by less important tasks.

Windows has multiple IRQL levels, starting from **PASSIVE_LEVEL**, where regular threads run, up to **HIGH_LEVEL**, reserved for critical system events. If you still didn’t get it, Think of IRQLs like a priority system for handling tasks on the processor.

For example, let’s say a system processing user input while also handling hardware interrupts (For now, just ignore those levels rather focus on the flow):

*   At **PASSIVE_LEVEL**, a user-mode application, like a text editor, runs normally.
*   If a network packet arrives, the system raises the IRQL to **DISPATCH_LEVEL** to process it, pausing lower-priority tasks.
*   If a hardware issue occurs, the IRQL jumps to **HIGH_LEVEL**, ensuring the system handles the critical event immediately before anything else.

This prevents low-priority tasks from delaying time-sensitive operations. Hope it makes sense now.

**Interrupt handling** as the name says, is the process by which a CPU temporarily stops executing its current task to respond to an event that needs immediate attention. These events, called **interrupts**, can come from hardware (e.g., a keyboard press, network packet arrival) or software (e.g., system calls, exceptions).

How It Works:

1.  A device or process triggers an **interrupt** (pausing the execution/flow).
2.  The CPU **pauses** its current task and **jumps** to a specific function, called an **Interrupt Service Routine (ISR) (**its nothing but a special function that runs when an interrupt occurs. It handles the event and then returns control to the previously running task.**)** to handle the event.
3.  Once the ISR finishes, the CPU **resumes** the interrupted task.

A best example (according to me) would be,

*   When you press a key, the keyboard **sends an interrupt** to the CPU.
*   The CPU **pauses** what it’s doing and runs the **keyboard ISR** to process the key press.
*   After handling it, the CPU **goes back** to its previous task.

**_Now, go to the top and read the DPC’s introduction once again, you might get that this time._** BTW, If you are curious about those IRQL levels then follow along. If you aren’t interested in their details then skip to the next part.

Windows defines several IRQL levels, ranging from `PASSIVE_LEVEL`, where normal thread execution occurs, to `HIGH_LEVEL`, which is used for critical system events. The key IRQLs are:

1.  **PASSIVE_LEVEL (0)**: The lowest IRQL where normal user-mode threads and most kernel-mode code execute. Code running at this level can access paged memory and perform blocking operations (e.g., file I/O etc)
2.  **APC_LEVEL (1)**: Used for Asynchronous Procedure Calls (APCs), which allow the kernel to execute deferred functions within a thread’s context. At this level, thread preemption is restricted to ensure APCs complete execution.
3.  **DISPATCH_LEVEL (2)**: At this level, normal thread execution is paused, and only high-priority kernel operations run. Code running at this level **cannot** access paged memory, as paging requires `PASSIVE_LEVEL`.
4.  **DIRQL (Device IRQLs)**: These levels vary per device and are assigned to hardware interrupts. ISRs execute at their assigned `DIRQL`, preventing lower-priority operations from interrupting them. Device drivers must ensure minimal execution time in ISRs and defer work using DPCs.
5.  **HIGH_LEVEL**: The highest IRQL, used only for system-critical operations, such as halting the system during a bug check (blue screen). No normal execution occurs at this level; only emergency shutdown procedures are allowed.

Why Are DPCs Needed?
====================

1.  **Efficient Interrupt Handling**: ISRs should execute quickly to avoid excessive interrupt latency. DPCs allow them to perform only critical work and offload the remaining processing.
2.  **Avoiding Blocking Operations at High IRQL**: Many kernel operations require running at lower IRQL levels to access paged memory. Since ISRs run at high IRQL, they cannot perform such operations safely.
3.  **Load Balancing on Multi-Core Systems**: DPCs can be scheduled on different processors, ensuring that interrupt-heavy tasks do not overload a single CPU core.

Types of DPCs in Windows (Can be skipped)
=========================================

I’ve wrote this part using ChatGPT (bcoz, I don’t know these either at the time of writing). I mean, It’s better to know about them but speaking in general, this would be useful if you are into windows driver development. Honestly, if you are just doing security research, you don’t really need to care about this.

1.  **Standard DPCs**: These are scheduled by drivers using the [_KeInsertQueueDpc_](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/wdm/nf-wdm-keinsertqueuedpc) API. Executed at _DISPATCH_LEVEL_ IRQL when the processor is free. Commonly used by device drivers for completing I/O operations after an interrupt.
2.  **Special Kernel DPCs**: Used internally by Windows, such as for timer expiration and context switching. Examples include [_KeSetTimerEx_](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/wdm/nf-wdm-kesettimerex), which schedules a timer DPC for execution at a later time.
3.  Custom DPCs for Drivers: Device drivers often create custom DPCs for handling deferred I/O operations. Example: Network drivers use DPCs to process incoming packets after a hardware interrupt signals new data arrival.

DPC Execution Flow
==================

DPCs execute via the following mechanism:

*   The Windows kernel maintains a per-processor DPC queue.
*   When a processor exits an ISR or returns from an interrupt, it checks the DPC queue.
*   If DPCs are pending, the kernel raises IRQL to `DISPATCH_LEVEL` and executes them.
*   Once all pending DPCs are processed, the system lowers IRQL back to normal levels.

![Image taken from flylib.com post on DPC](https://miro.medium.com/v2/resize:fit:1000/format:webp/0*LI3yDLzGWk44j65a.gif)

Interaction Between Kernel, IRQL, and DPCs
==========================================

1.  When an ISR executes at `DIRQL`, it cannot call functions that require `PASSIVE_LEVEL`.
2.  Instead, the ISR schedules a DPC, which executes at `DISPATCH_LEVEL` and performs the deferred processing.
3.  If further processing requires `PASSIVE_LEVEL`, the DPC can offload work to a worker thread.

Things are going to get spicy now…Why Are DPCs Interesting for Exploitation?
============================================================================

DPCs execute at `DISPATCH_LEVEL` IRQL, meaning they have direct kernel access and run with high privileges. This makes them an attractive target for attackers. Some of the vectors that you could focus (These are the usecases that I am aware of. There can be multiple other usecases too. If you know any other ways, please let me know, I can modify this part) are:

*   **Privilege Escalation:** If an attacker can gain control over a function pointer executed in a DPC, they may execute arbitrary code in kernel mode.
*   **Arbitrary Memory Access:** DPCs run at `DISPATCH_LEVEL`, meaning they can access kernel memory, which could be exploited to manipulate system structures.
*   **Bypassing Security Mechanisms:** Some security solutions rely on callbacks and hooks, which could be bypassed or tampered with using DPCs.

Exploiting DPCs for Privilege Escalation
========================================

If an attacker can manipulate a queued DPC entry to point to their shellcode/attacker controlled memory region, they can execute arbitrary code in kernel mode. This could lead to privilege escalation.

Vulnerable drivers may register a DPC routine using `_KeInsertQueueDpc_`. If an attacker can overwrite this function pointer, they can redirect execution to arbitrary code. The sample flow might look like this,

1.  Identify a vulnerable driver that schedules a DPC and stores a function pointer in writable memory.
2.  Use a write-what-where primitive to overwrite the function pointer with the address of shellcode.
3.  Trigger the DPC execution, causing the shellcode to run at `DISPATCH_LEVEL` IRQL.

Afaik, If your target is implemented with PatchGuard or SMEP or HVCI in general, this won’t work. There might be work bypasses for this but I don’t know (atleast for now!!!)

BTW, the above mentioned flow was based on CVE-2021–28314. So, for detailed analysis, please read the root cause analysis of that bug.

As I always mention in my posts, there may be many other primitives beyond this. I’m far from calling myself a vulnerability researcher , I still have a lot to learn and explore. These are just some of the primitives I came across while reading other blogs, and I’m always grateful to the authors who take the time to document the root cause analysis of the bugs they discover.

That’s all for now! Hope you guys find this post interesting and useful. Follow me on [LinkedIn](https://www.linkedin.com/in/dharani-sanjaiy-/), [Medium](https://medium.com/@WaterBucket), [X](https://x.com/DharaniSanjaiy).

_PEACE!_

REFERENCES:
===========

A Look at Modern Windows Kernel Exploitation/Hacking Stream -> [https://www.youtube.com/live/nauAlHXrkIk?feature=shared](https://www.youtube.com/live/nauAlHXrkIk?feature=shared)

[Introduction to DPCs - Windows drivers
--------------------------------------

### Introduction to DPCs

- Windows drivers Introduction to DPCslearn.microsoft.com](https://learn.microsoft.com/en-us/windows-hardware/drivers/kernel/introduction-to-dpcs?source=post_page-----ecd138292883---------------------------------------)

[Introduction to DPC Objects - Windows drivers
---------------------------------------------

### Introduction to DPC Objects

- Windows drivers Introduction to DPC Objectslearn.microsoft.com](https://learn.microsoft.com/en-us/windows-hardware/drivers/kernel/introduction-to-dpc-objects?source=post_page-----ecd138292883---------------------------------------)

[Deferred Procedure Calls (DPCs)
-------------------------------

### The Windows 2000 Device Driver Book: A Guide for Programmers (2nd Edition),2000, (isbn 0130204315, ean 0130204315), by…

flylib.com](https://flylib.com/books/en/2.14.1.26/1/?source=post_page-----ecd138292883---------------------------------------)

[Deferred Procedure Call - Wikipedia
-----------------------------------

### From Wikipedia, the free encyclopedia A Deferred Procedure Call ( DPC) is a Microsoft Windows operating system…

en.wikipedia.org](https://en.wikipedia.org/wiki/Deferred_Procedure_Call?source=post_page-----ecd138292883---------------------------------------)

[Deferred Procedure Call Details
-------------------------------

### Deferred Procedure Calls (DPCs) are a commonly used feature of Windows. Their uses are wide and varied, but they are…

www.osr.com](https://www.osr.com/nt-insider/2009-issue1/deferred-procedure-call-details/?source=post_page-----ecd138292883---------------------------------------)
