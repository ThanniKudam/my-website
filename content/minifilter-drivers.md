---
title: "Understanding Mini-Filter Drivers for Windows Vulnerability Research & Exploit Development"                                        
date: "31-03-2025"          
excerpt: "Just wanted to understand what they are, How they work, How to write such drivers, How they are different from the legacy drivers etc etc."                                                            
readTime: "10 min read"
tags: ["Windows Internals", "MiniFilterDrivers", "VR"]
author: "WaterBucket"
---


Understanding Mini-Filter Drivers for Windows Vulnerability Research & Exploit Development
==========================================================================================

![Frogs are cute!!](https://miro.medium.com/v2/resize:fit:1400/format:webp/0*FHRR7Tfj-a6YnlFO.jpg)

Hey everyone! Hope you’re all doing well. As always, I was looking for an interesting Windows internals topic to blog about. I google-d around, asked ChatGPT for ideas, but most of the suggestions were pretty generic.. Things like system calls, PFNs, and PTEs, which already have great write-ups from other researchers. Finally, I came across Mini-Filter Drivers. They seemed intriguing, and while there are a few posts on the topic (James Forshaw has a [great write-up](https://googleprojectzero.blogspot.com/2021/01/hunting-for-bugs-in-windows-mini-filter.html) on finding bugs in them ❤), I wanted to understand what they are, How they work, How to write such drivers, How they are different from the legacy drivers etc etc., And here it is!! Hope it would be useful!

So what in the world is a Mini-Filter Driver?
=============================================

Basically, Mini-Filter Drivers are one of the components of modern Windows file system architecture. They provide a way for developers to monitor and modify file system operations without needing to interact directly with lower-level file system drivers. Mini-filters operate within the file system filter driver framework, allowing them to intercept and process I/O operations in a structured manner.

They sit between the user-mode application and the file system. They leverage the **Filter Manager (**_a Microsoft-provided kernel-mode component that simplifies interaction with the file system stack_). This architecture allows mini-filters to attach dynamically to volumes and intercept I/O requests at various levels. This way it ensures deterministic load order, controlled request routing, and isolation between filters.

Wait!!
======

![Wait, They don’t love you like I love you…. (Trying to fit into society)](https://miro.medium.com/v2/resize:fit:330/format:webp/0*SA_iJyYHg27PKnio.gif)

You have to first understand what File System Filter Drivers are, before getting to know about Mini-Filter Drivers so go read about them then come back to this post.. JK, I’ll give a short introduction of them. [Microsoft](https://docs.microsoft.com/en-us/windows-hardware/drivers/ifs/about-file-system-filter-drivers) quotes File System Filter Drivers as:

_“A file system filter driver can filter I/O operations for one or more file systems or file system volumes. Depending on the nature of the driver, filter can mean log, observe, modify, or even prevent. Typical applications for file system filter drivers include antivirus utilities, encryption programs, and hierarchical storage management systems.”_

TL;DR, Filter driver can inspect and modify almost any IO request sent to a file system. A simplified request flow would look something like this,

![Image taken from Evading EDRs book — Chapter 6](https://miro.medium.com/v2/resize:fit:2000/format:webp/1*smBS2q5tbd5usHNx-aZeCg.png)

When a user-mode application requests to interact with a file (e.g., opening, reading, or writing), the request transitions into kernel mode, where the I/O Manager processes it and generates an I/O Request Packet (IRP). This IRP is then passed through a stack of drivers before reaching the file system driver. As shown in the diagram, the flow follows:

1.  **User Mode Request** — A user-mode application makes a request to interact with a file
2.  **I/O Manager** — The request enters kernel mode, where the I/O Manager processes it and creates an IRP.
3.  **Legacy Filter Driver A** — This driver intercepts the request and can inspect, modify, or block it before passing it further down the stack.
4.  **Legacy Filter Driver B** — Another filter driver that has the opportunity to process the IRP before forwarding it.
5.  **Filesystem Driver (e.g.,** `**ntfs.sys**`**)** – The final destination of the IRP, where the file system driver handles the operation and interacts with the storage device.

Filter drivers, like those labeled as “_Legacy Filter Driver A_” and “_Legacy Filter Driver B,_” register for specific I/O requests and can choose to:

*   Pass the IRP unmodified to the next driver (Like we did in the image)
*   Modify the IRP before passing it along.
*   Alter the response of the IRP.
*   Complete the IRP with a success or failure status.
*   Redirect the IRP to a different device stack.

Since IRPs do not automatically propagate down the stack, a filter driver must explicitly pass the IRP along if further processing is required. Otherwise, it can complete the IRP itself, preventing lower drivers (including the file system driver) from seeing the request. If a filter driver wants to inspect or modify the response, it should register a completion routine. This design allows filter drivers to monitor and control file system operations, making them useful for applications like antivirus software, encryption systems, and monitoring tools.

The Rise of Mini-Filter Drivers!
================================

Legacy filter drivers have several drawbacks that impact system stability, performance, and compatibility. Managing their position in the device stack is complex, and conflicts often arise when multiple filter drivers attempt to process the same I/O request. Poorly implemented filter drivers can cause system crashes, and inefficient handling of IRPs may introduce unnecessary latency. These issues make it difficult to maintain a reliable and efficient filtering mechanism, especially when different software components interact with the same file system requests.

To address these limitations, Microsoft introduced the filter manager model. The filter manager (_fltmgr.sys_) is a driver that ships with Windows and provides a standardized framework for handling file system filtering operations. Instead of requiring developers to manually manage filter driver stacking, the filter manager abstracts this process and ensures that requests are handled in a controlled manner.

This is when Mini-Filter Drivers comes into play.. With this approach, developers can write **minifilters**, which are more lightweight and easier to implement compared to legacy filter drivers. The filter manager intercepts requests destined for the file system and distributes them to the minifilters registered in the system (Refer to the below mentioned image for reference). Unlike legacy filter drivers, minifilters operate within a structured, sorted stack managed by the filter manager, reducing conflicts and improving system stability.

![Again, Image taken from Evading EDRs book. Thanks to Matt Hand :)](https://miro.medium.com/v2/resize:fit:2000/format:webp/1*bTQA1Pr77LVGbztEd1WWFQ.png)

In this model, when a user-mode application interacts with a file, the request is first handled by the **I/O Manager**, which is responsible for processing all I/O requests in Windows. Instead of directly passing the request to legacy filter drivers, as in the older model, the I/O Manager forwards the request to the **Filter Manager (_fltmgr.sys_)** in kernel mode.

The **Filter Manager** is responsible for managing and organising mini-filter drivers that are registered to intercept file system operations. By the way, If you guys noticed.. In the above image, you could see a mention of altitude. What are they? Why they are used here? Well, Let’s talk about them.The main reason for Mini-Filter Drivers being organised is because of altitudes, which define their position in the filter stack.

_Altitudes are numerical values assigned to minifilters to determine their order of execution when processing I/O requests. A higher altitude means the minifilter is positioned closer to the top of the stack and processes requests before lower-altitude mini-filters._ Altitudes are managed by Microsoft, with ranges defined for load order groups like FSFilter Anti-Virus or FSFilter Encryption, as per [Load Order Groups and Altitudes for Minifilter Drivers — Windows drivers | Microsoft Learn](https://learn.microsoft.com/en-us/windows-hardware/drivers/ifs/load-order-groups-and-altitudes-for-minifilter-drivers).

> _NOTE: Pre-operation callbacks are called from highest to lowest altitude, while post-operation callbacks are processed in reverse, ensuring ordered processing._

Also you can list the Mini-Filters and their altitudes in your machine using the powershell command “_fltmc filters_”.

![captionless image](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*Tm4kaHtUD1ziqZkSkzH3vw.png)

Microsoft ensures security with these.. For example, An antivirus software with high altitude would operate before other types of filters, while encryption or backup filters are placed lower to act after security checks. Now going back to the flow chart (1st & 2nd step will be same as of the legacy filter drivers):

**3. Mini-filter B (altitude: 309000)** — This mini-filter is positioned at the highest altitude, meaning it intercepts the request before the lower-altitude mini-filters.

**4. Mini-filter B (altitude: 268000)** — This mini-filter operates at a lower altitude than the first Mini-filter B but still processes the request before Mini-filter C.

**5. Mini-filter C (altitude: 145000)** — This mini-filter is positioned at the lowest altitude in the stack and processes the request last before it reaches the **Filesystem Driver (e.g., _ntfs.sys_)**.

Communication with User-mode Applications
=========================================

The communication between the Mini-Filter Drivers and the user-mdoe applications is established using **Filter Communication Ports**, which allow secure message passing between kernel-mode drivers and user-mode processes. [Microsoft](https://learn.microsoft.com/en-us/windows-hardware/drivers/ifs/filter-manager-concepts) provides several APIs for this.

For **Kernel Mode (Mini-filter Driver)**:

1.  [_FltCreateCommunicationPort_](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/fltkernel/nf-fltkernel-fltcreatecommunicationport) (): Creates a named communication port.
2.  [_FltSendMessage_](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/fltkernel/nf-fltkernel-fltsendmessage)_():_ Sends messages from the driver to user-mode.
3.  _FltReceiveMessage():_ Receives messages sent from user-mode.
4.  [_FltCloseCommunicationPort_](https://learn.microsoft.com/en-us/windows-hardware/drivers/ddi/fltkernel/nf-fltkernel-fltclosecommunicationport) (): Closes the port when communication is no longer needed.

User Mode (Application):

1.  [_FilterConnectCommunicationPort_](https://learn.microsoft.com/en-us/windows/win32/api/fltuser/nf-fltuser-filterconnectcommunicationport)_():_ Connects to the minifilter driver’s communication port.
2.  [_FilterSendMessage_](https://learn.microsoft.com/en-us/windows/win32/api/fltuser/nf-fltuser-filtersendmessage)_():_ Sends messages to the driver.
3.  [_FilterGetMessage_](https://learn.microsoft.com/en-us/windows/win32/api/fltuser/nf-fltuser-filtergetmessage)_():_ Receives messages from the driver.

Let’s write a simple Mini-Filter Driver for better understanding. Made using LLMs but it’s quite easy to understand once you are aware of the theory. I mean, MSDN explains each of the following functions in greate detail so I won’t be explaining the code much.. rather I have shared the associated MSDN links to each of those functions (see above).

Driver Code:
------------

```C
#include <fltKernel.h>
PFLT_FILTER g_FilterHandle = NULL;
PFLT_PORT g_ServerPort = NULL;
PFLT_PORT g_ClientPort = NULL;
// Connection callback
NTSTATUS ConnectNotifyCallback(
    PFLT_PORT ClientPort,
    PVOID ServerPortCookie,
    PVOID ConnectionContext,
    ULONG SizeOfContext,
    PVOID *ConnectionPortCookie
) {
    UNREFERENCED_PARAMETER(ServerPortCookie);
    UNREFERENCED_PARAMETER(ConnectionContext);
    UNREFERENCED_PARAMETER(SizeOfContext);
    g_ClientPort = ClientPort;
    return STATUS_SUCCESS;
}
// Disconnection callback
VOID DisconnectNotifyCallback(PVOID ConnectionPortCookie) {
    UNREFERENCED_PARAMETER(ConnectionPortCookie);
    if (g_ClientPort) {
        FltCloseClientPort(g_FilterHandle, &g_ClientPort);
        g_ClientPort = NULL;
    }
}
// Message callback
NTSTATUS MessageNotifyCallback(
    PVOID PortCookie,
    PVOID InputBuffer,
    ULONG InputBufferLength,
    PVOID OutputBuffer,
    ULONG OutputBufferLength,
    PULONG ReturnOutputBufferLength
) {
    UNREFERENCED_PARAMETER(PortCookie);
    if (InputBufferLength < sizeof(CHAR)) {
        return STATUS_INVALID_PARAMETER;
    }
    DbgPrint("Mini-Filter received: %s\n", (char*)InputBuffer);
    if (OutputBuffer && OutputBufferLength >= sizeof("ACK")) {
        RtlCopyMemory(OutputBuffer, "ACK", 3);
        *ReturnOutputBufferLength = 3;
    }
    return STATUS_SUCCESS;
}
// Create communication port
NTSTATUS CreateCommunicationPort() {
    OBJECT_ATTRIBUTES objAttr;
    UNICODE_STRING portName = RTL_CONSTANT_STRING(L"\\MyFilterPort");
    InitializeObjectAttributes(&objAttr, &portName, OBJ_KERNEL_HANDLE, NULL, NULL);
    PSECURITY_DESCRIPTOR sd;
    FltBuildDefaultSecurityDescriptor(&sd, FLT_PORT_ALL_ACCESS);
    NTSTATUS status = FltCreateCommunicationPort(
        g_FilterHandle,
        &g_ServerPort,
        &objAttr,
        NULL,
        ConnectNotifyCallback,
        DisconnectNotifyCallback,
        MessageNotifyCallback,
        1
    );
    FltFreeSecurityDescriptor(sd);
    return status;
}
// Send message from kernel to user-mode
void SendMessageToUserMode() {
    if (g_ClientPort) {
        CHAR message[] = "Hello from Kernel!";
        ULONG replyLength = 0;
        NTSTATUS status = FltSendMessage(
            g_FilterHandle, g_ClientPort, message, sizeof(message), NULL, &replyLength, NULL
        );
        if (NT_SUCCESS(status)) {
            DbgPrint("Message sent successfully!\n");
        }
    }
}
// Filter unload routine
NTSTATUS FilterUnload(FLT_FILTER_UNLOAD_FLAGS Flags) {
    UNREFERENCED_PARAMETER(Flags);
    if (g_ServerPort) {
        FltCloseCommunicationPort(g_ServerPort);
    }
    if (g_FilterHandle) {
        FltUnregisterFilter(g_FilterHandle);
    }
    return STATUS_SUCCESS;
}
// Filter registration structure
CONST FLT_REGISTRATION FilterRegistration = {
    sizeof(FLT_REGISTRATION),  // Size
    FLT_REGISTRATION_VERSION,  // Version
    0,                         // Flags
    NULL,                      // Contexts
    NULL,                      // Callbacks
    FilterUnload,              // Unload routine
    NULL,                      // Instance setup
    NULL,                      // Instance query teardown
    NULL,                      // Instance teardown start
    NULL,                      // Instance teardown complete
    NULL,                      // Generate file name
    NULL,                      // Normalize name component
    NULL,                      // Normalize context cleanup
    NULL,                      // Transaction notification
    NULL,                      // Section notification
    NULL                       // Padding
};
// Driver entry point
NTSTATUS DriverEntry(PDRIVER_OBJECT DriverObject, PUNICODE_STRING RegistryPath) {
    UNREFERENCED_PARAMETER(DriverObject);
    UNREFERENCED_PARAMETER(RegistryPath);
    NTSTATUS status = FltRegisterFilter(DriverObject, &FilterRegistration, &g_FilterHandle);
    if (!NT_SUCCESS(status)) {
        return status;
    }
    status = CreateCommunicationPort();
    if (!NT_SUCCESS(status)) {
        FltUnregisterFilter(g_FilterHandle);
        return status;
    }
    return FltStartFiltering(g_FilterHandle);
}
```

Basically the flow will be,

1.  The communication port (_\MyFilterPort_) allows user-mode applications to send messages to the mini-filter driver.
2.  When a message is received, the MessageNotifyCallback() logs it and optionally replies with “ACK”
3.  The kernel-mode driver can send messages to the user-mode application using _FltSendMessage_().
4.  The driver registers itself using _FltRegisterFilter_() and starts filtering with _FltStartFiltering_().
5.  The unload function (_FilterUnload_) ensures that the filter and communication ports are properly cleaned up.

User-Mode Application Code:
---------------------------

```C
#include <windows.h>
#include <stdio.h>
#define PORT_NAME L"\\\\.\\MyFilterPort"
int main() {
    HANDLE hPort;
    DWORD bytesReturned;
    char sendBuffer[] = "Hello from User!";
    char recvBuffer[256] = {0};
    // Open a handle to the filter's communication port
    hPort = CreateFileW(PORT_NAME, GENERIC_READ | GENERIC_WRITE, 0, NULL, OPEN_EXISTING, 0, NULL);
    if (hPort == INVALID_HANDLE_VALUE) {
        printf("Failed to connect to filter port. Error: %lu\n", GetLastError());
        return 1;
    }
    printf("Connected to minifilter communication port.\n");
    // Send message to minifilter
    if (!WriteFile(hPort, sendBuffer, sizeof(sendBuffer), &bytesReturned, NULL)) {
        printf("WriteFile failed. Error: %lu\n", GetLastError());
        CloseHandle(hPort);
        return 1;
    }
    printf("Sent to kernel: %s\n", sendBuffer);
    // Receive response from minifilter
    if (ReadFile(hPort, recvBuffer, sizeof(recvBuffer), &bytesReturned, NULL)) {
        printf("Received from kernel: %s\n", recvBuffer);
    } else {
        printf("ReadFile failed. Error: %lu\n", GetLastError());
    }
    // Close the handle
    CloseHandle(hPort);
    return 0;
}
```

Here the flow would be,

1.  Opens a handle to the minifilter’s communication port (_\MyFilterPort_).
2.  Sends a message (_“Hello from User!”_) to the mini-filter driver.
3.  Reads the response from the mini-filter (which should be “ACK” from _MessageNotifyCallback_).
4.  Handles errors properly if connection or communication fails.

I’m intentionally skipping the compilation, loading the driver part because there are a ton of resources & video tutorials available for the same.

That’s all for now! Hope you guys find this post interesting and useful. My next blog would be more of like a walkthrough of a driver from 2021 which was used by some APT Groups to disable AV/EDR Process or Other Protected Processes in General. There are already a couple of posts going through the same but I wanted to write it in a beginner friendly manner so let’s see.

Follow me on [LinkedIn](https://www.linkedin.com/in/dharani-sanjaiy-/), [Medium](https://medium.com/@WaterBucket), [X](https://x.com/DharaniSanjaiy).

_PEACE!_

REFERENCES:
===========

[Hunting for Bugs in Windows Mini-Filter Drivers
-----------------------------------------------

### Posted by James Forshaw, Project Zero In December Microsoft fixed 4 issues in Windows in the Cloud Filter and Windows…

googleprojectzero.blogspot.com](https://googleprojectzero.blogspot.com/2021/01/hunting-for-bugs-in-windows-mini-filter.html?source=post_page-----391153c945d6---------------------------------------)

[Understanding Minifilters: Why and How File System Filter Drivers Evolved
-------------------------------------------------------------------------

### We've been running our new and improved Developing File System Minifilters for Windows seminar for some time now. And…

www.osr.com](https://www.osr.com/nt-insider/2019-issue1/the-state-of-windows-file-system-filtering-in-2019/?source=post_page-----391153c945d6---------------------------------------)

[Understanding the Windows File System Filter Driver
---------------------------------------------------

### What is a Windows file system filter driver? How does a Windows minifilter driver works and how does it fit into the…

www.easefilter.com](https://www.easefilter.com/kb/understand-minifilter.htm?srsltid=AfmBOoqGpKK4VVbXlquTNq3pbMVT4IsReF1pY-CnDsrugeh_al2nlErd&source=post_page-----391153c945d6---------------------------------------)

[https://nostarch.com/download/EvadingEDR_chapter6.pdf](https://nostarch.com/download/EvadingEDR_chapter6.pdf) (It’s an awesome book, I would recommend everyone to buy this book if you are interested in Malware Development or Windows Internals in general.)
