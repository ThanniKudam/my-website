---
title: "Understanding IOCTLs for Windows Vulnerability Research & Exploit Development"                                        
date: "14-12-2024"          
excerpt: "Following up on my previous post about the role of RFCs in vulnerability research, I thought it would be nice to explore IOCTLs, a crucial element in vulnerability research, exploit development, and reverse engineering Windows drivers."                                                            
readTime: "7 min read"
tags: ["Windows Internals", "IOCTLs", "VR"]
author: "WaterBucket"
---

**Understanding IOCTLs for Windows Vulnerability Research & Exploit Development**
=================================================================================

![I couldn’t able to find a better thumbnail for this post :(](https://miro.medium.com/v2/resize:fit:1280/format:webp/0*ZG9DlJndK-v0FJhk.png)

Following up on my previous post about the role of RFCs in vulnerability research, I thought it would be nice to explore IOCTLs, a crucial element in vulnerability research, exploit development, and reverse engineering Windows drivers. This post will be split into two parts. The first part (this one) will be more theoretical, featuring code samples to illustrate the structure of IOCTLs, a brief overview of IRPs, how Dispatch routines function, and how IRPs and IOCTLs interact. The second part will dive into practical examples, focusing on IOCTLs from the point of view of EoP and demonstrating how these concepts come into play.

> Why this topic, you might ask? If you’ve ever considered reversing Windows drivers or have come across blogs discussing various EoP vulnerabilities either through third-party drivers or Windows itself (ily project zero), chances are you’ve encountered references to IOCTLs. While there are some resources out there, most only offer brief mentions of IOCTLs, without delving into the details (I’m not talking about MSDN). That’s why I thought of writing about this one (Honestly, I haven’t had much time to research into other interesting topics, but I’ve promised myself to publish a blog every month. So, to keep that, I’m writing about something I’m already pretty familiar with ^_^)

So, What are IOCTLs?
====================

Input/Output Control (IOCTL) is a control code that allows user-mode applications to send specific commands to device drivers. These commands can trigger various operations, such as reading data, writing data, or performing hardware-specific tasks.

Windows drivers interact with these commands through the `_DeviceIoControl_` API in user-mode and corresponding IRP (I/O Request Packet) handling functions in kernel-mode.

Basic Structure of an IOCTL
---------------------------

IOCTLs are represented as DWORDs but each of the 32 bits represent a detail about the request — Device Type, Required Access, Function Code, and Transfer Type. Microsoft created a [visual diagram](https://docs.microsoft.com/en-us/windows-hardware/drivers/kernel/defining-i-o-control-codes) to break these fields down:

![https://learn.microsoft.com/en-us/windows-hardware/drivers/kernel/defining-i-o-control-codes](https://miro.medium.com/v2/resize:fit:966/format:webp/0*e6VmxZhEF__B3s_b.png)

*   **_Transfer Type_** _— Defines the way that data will be passed to the driver. These can either be_ `_METHOD_BUFFERED_`_,_ `_METHOD_IN_DIRECT_`_,_ `_METHOD_OUT_DIRECT_`_, or_ `_METHOD_NEITHER_`_._
*   **_Function Code_** _— The internal function to be executed by the driver. These are supposed to start at 0x800 but you will see many starting at 0x0 in practice. The Custom bit is used for vendor-assigned values._
*   **_Device Type_** _— The type of the driver’s device object specified during IoCreateDevice(Secure)(). There are_ [_many device types defined_](https://docs.microsoft.com/en-us/windows-hardware/drivers/kernel/specifying-device-types) _in Wdm.h and Ntddk.h, but one of the most common to see for software drivers is_ `_FILE_DEVICE_UNKNOWN (0x22)_`_. The Common bit is used for vendor-assigned values._

The above description is taken from Microsoft’s documentation but Bit-Level Breakdown would make more sense as the description provided by Microsoft defines at a conceptual level.

But I prefer this one,

```C
31          16 15          14 13      2 1        0
+-------------+-------------+---------+----------+
| Device Type | Access Type | Function | Method  |
+-------------+-------------+---------+----------+
```

*   **Device Type (16 bits)**: Identifies the type of device. For example, `_FILE_DEVICE_DISK_` or `_FILE_DEVICE_UNKNOWN_`.
*   **Access Type (2 bits)**: Specifies the level of privilege needed to execute the IOCTL. The options include `FILE_ANY_ACCESS (0x00)` for no specific access requirement, `FILE_READ_ACCESS (0x01)` for read access, and `FILE_WRITE_ACCESS (0x02)` for write access.
*   **Function Codes(12 bits)**: This is a unique identifier for the operation the driver should perform. Function codes typically range from `0x800` to `0xFFF` for custom functions, with each code representing a specific action the driver is tasked with executing.
*   **Method (2 bits)**: The method defines how data is passed between user-mode and kernel-mode. There are several transfer methods: `METHOD_BUFFERED`, where data is copied to and from a buffer provided by the I/O manager; `METHOD_IN_DIRECT`, used for large input buffers transferred via Direct Memory Access (DMA); `METHOD_OUT_DIRECT`, for large output buffers transferred via DMA; and `METHOD_NEITHER`, where pointers are passed directly and the driver is responsible for validating them.

This second description is more technical, bit-level representation of how the IOCTL is actually constructed in memory. It’s more focused on the binary layout of the 32-bit IOCTL value rather than being just conceptual.

Example IOCTL Definition
------------------------

This is example of an IOCTL definition in a driver:

```C
#define IOCTL_CUSTOM_OPERATION \
    CTL_CODE(FILE_DEVICE_UNKNOWN, 0x800, METHOD_BUFFERED, FILE_ANY_ACCESS)
/*
Device Type: FILE_DEVICE_UNKNOWN (0x22)
Function: 0x800
Method: METHOD_BUFFERED
Access: FILE_ANY_ACCESS
When you call DeviceIoControl with this code, the driver will execute the corresponding function if implemented.
*/
```

Understanding IRPs (I/O Request Packets)
========================================

According to chatGPT “_An_ **_I/O Request Packet (IRP)_** _is a data structure used by the Windows I/O Manager to represent I/O requests. When a user-mode application calls_ `_DeviceIoControl_` _(or other I/O-related APIs), the I/O Manager creates an IRP to encapsulate the request details and passes it to the corresponding device driver.”_

I/O Request Packets (IRPs) are essentially just an instruction for the driver. These packets allow the driver to act on the specific major function by providing the relevant information required by the function. There are many major function codes but the most common ones are `IRP_MJ_CREATE`, `IRP_MJ_CLOSE`, and `IRP_MJ_DEVICE_CONTROL`. These correlate with user mode functions:

*   `IRP_MJ_CREATE` → `CreateFile`
*   `IRP_MJ_CLOSE` → `CloseFile`
*   `IRP_MJ_DEVICE_CONTROL` → `DeviceIoControl`

Definitions in `DriverEntry` may look like this:

```C
DriverObject->MyFunction[IRP_MJ_CREATE] = MyCreateCloseFunction;
DriverObject->MyFuntion[IRP_MJ_CLOSE] = MyCreateCloseFunction;
DriverObject->MyFunction[IRP_MJ_DEVICE_CONTROL] = MyDeviceControlFunction;
```

> But what is a DriverEntry? Well, `DriverEntry` is the entry point for a Windows driver, similar to `main()` in C/C++. It is responsible for initializing key driver components, such as creating the device object and symbolic link for communication. The function typically calls `IoCreateDevice()` or `IoCreateDeviceSecure()` to create the device object, with the secure version applying access restrictions. It then sets up a symbolic link using `IoCreateSymbolicLink()` to allow user-mode processes to interact with the driver. Additionally, `DriverEntry` defines essential functions like IRP handlers and unload routines. You can read more about them from [here](https://learn.microsoft.com/en-us/windows-hardware/drivers/wdf/driverentry-for-kmdf-drivers)

When the following code in user mode is executed, the driver will receive an IRP with the major function code `IRP_MJ_CREATE` and will execute the `MyCreateCloseFunction` function:

```C
hDevice = CreateFile(L"\\\\.\\MyDevice", GENERIC_WRITE|GENERIC_READ, 0, NULL, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);
```

The most important major function for us in almost all cases will be `IRP_MJ_DEVICE_CONTROL` as it is used to send requests to perform a specific internal function from user mode. These requests include an IO Control Code which tells the driver exactly what to do, as well as a buffer to send data to and receive data from the driver.

The flow diagram of how IOCTLs are sent and processed can look something like this:

![Image taken from POPKORN research paper.](https://miro.medium.com/v2/resize:fit:1400/format:webp/0*kIewDdwUyjaES3Af.png)

1.  The user-mode application acquires a handle to the symbolic link.
2.  It uses `DeviceIoControl()` to send the necessary IOCTL and input/output buffers to the symlink.
3.  The symlink points to the driver’s device object, allowing the driver to receive the application’s packet (IRP).
4.  The driver identifies that the packet came from `DeviceIoControl()` and passes it to the internal function `MyCtlFunction()`.
5.  `MyCtlFunction()` maps the function code `0x800` to the internal function `SomeFunction()`, which is then executed.
6.  The IRP is completed, and the status, along with any output data, is returned to the user via the output buffer provided by the application.

How IOCTLs and IRPs Work Together?
==================================

The simplified process would be like this,

1.  **User-Mode Call**: A user-mode application calls `DeviceIoControl` with an IOCTL code and input/output buffers.
2.  **IRP Creation**: The I/O Manager creates an IRP and fills in the stack location with details about the IOCTL request.
3.  **Dispatch to Driver**: The IRP is dispatched to the driver’s `IRP_MJ_DEVICE_CONTROL` routine.
4.  **Driver Processing:** The driver processes the IRP, performs the requested operation, and sets the `IoStatus` field.

> BTW “dispatched” refers to the process of passing the **IRP** (I/O Request Packet) to the appropriate **dispatch routine** in the driver for processing. When the I/O Manager creates the IRP and adds the necessary details, it “dispatches” it to the driver’s corresponding function, like **IRP_MJ_DEVICE_CONTROL**, which handles that specific request type (in this case, an IOCTL request).

**5. Completion**: The driver completes the IRP, and the result is returned to the user-mode application.

I know its pretty boring reading theories like IOCTLs can be pretty dry, especially since once you dive into IOCTLs, you’ll also need to understand things like IRPs, dispatch routines etc. It’s a whole ongoing topic.My best advice is to try writing a simple driver as you can understand the stuffs better. Or, maybe check out some EoP blog posts (there are tons of them), and I’ll link a few at the end. You can also look at the HackSys Extreme Vulnerable Driver source code for more insights. Anyway, that’s all for now. The second part will come soon, and I promise it’ll be way more interesting, as we’ll dive into a real CVE to better understand these concepts!

Hope you guys find this post interesting and useful. Follow me on [LinkedIn](https://www.linkedin.com/in/dharani-sanjaiy-/), [Medium](https://medium.com/@WaterBucket), [X](https://x.com/DharaniSanjaiy).

_PEACE!_

**REFERENCES:**
---------------

If you want to understand the concepts in practical manner or want to see how IOCTLs are actually used while developing a driver, go through this amazing post from Nikhil [https://ghostbyt3.github.io/blog/Kernel_Exploitation_Primer_0x0](https://ghostbyt3.github.io/blog/Kernel_Exploitation_Primer_0x0)

[https://dl.acm.org/doi/pdf/10.1145/3564625.3564631](https://dl.acm.org/doi/pdf/10.1145/3564625.3564631) (**_Highly recommended, I read this paper a couple of times while I was learning about IOCTLs_**).

[https://www.cyberark.com/resources/threat-research-blog/finding-bugs-in-windows-drivers-part-1-wdm](https://www.cyberark.com/resources/threat-research-blog/finding-bugs-in-windows-drivers-part-1-wdm)

[Windows Drivers are True'ly Tricky
----------------------------------

### Posted by James Forshaw, Driving for Bugs Auditing a product for security vulnerabilities can be a difficult challenge…

googleprojectzero.blogspot.com](https://googleprojectzero.blogspot.com/2015/10/windows-drivers-are-truely-tricky.html?source=post_page-----c49229b38d8d---------------------------------------)

[Hunting Vulnerable Kernel Drivers
---------------------------------

### In information security, even seemingly insignificant issues could pose a significant threat. One notable vector of…

blogs.vmware.com](https://blogs.vmware.com/security/2023/10/hunting-vulnerable-kernel-drivers.html?source=post_page-----c49229b38d8d---------------------------------------)

[https://blog.talosintelligence.com/exploring-malicious-windows-drivers-part-1-introduction-to-the-kernel-and-drivers/](https://blog.talosintelligence.com/exploring-malicious-windows-drivers-part-1-introduction-to-the-kernel-and-drivers/) (Another great blog)

[https://github.com/hacksysteam/HackSysExtremeVulnerableDriver](https://github.com/hacksysteam/HackSysExtremeVulnerableDriver)
