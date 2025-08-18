---
title: "Build it Before Breaking it !! — PART 2"                                        
date: "24-10-2023"          
excerpt: "In this blog, we will be going through on how to setup Constrained Delegation lab."                                                            
readTime: "04 min read"
tags: ["active-directory", "kerberos", "red-team"]
author: "WaterBucket"
---

Build it Before Breaking it !! — PART 2
=======================================

Hi Everyone. First of all, Thanks for the response that you people gave for the last blog which is the First Part of “Build it Before Breaking it !! — PART 1”. 

As promised, In this blog, we will be going through on how to setup Constrained Delegation lab.

![captionless image](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*K0sb_MsDdGZJrtj0rLv4jQ.png)

Let’s get started !!

What is Unconstrained Delegation BTW?

Unconstrained delegation, also known as Protocol Transition is a security feature in Microsoft Windows Active Directory environments which allows a service to impersonate a user, meaning the service can act on behalf of the user and access network resources as if it were the user.

For a computer to authenticate on behalf of other services (unconstrained delegation) two conditions are required:

1.  Account has the **TRUSTED_FOR_DELEGATION** flag in the User Account Control (UAC) flags.
2.  User account has not the **NOT_DELEGATED** flag set which by default non domain accounts have this flag.

For this, I will be creating an user account and a computer account for the demonstration purposes.

**ACCOUNT CREATION:**
=====================

Follow the steps that are mentioned below for setting-up an user account.

Boot-up your windows server , open _Windows Server Manager → Tools → Click ‘Active Directory Users and Computers’_

![captionless image](https://miro.medium.com/v2/resize:fit:1146/format:webp/1*dBioftvjJcWByzqOO_ZA8Q.png)

Under the _forest_ [Here APT.LOCAL] , Right click on _Users → New → User._

![captionless image](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*zi1Wm7-jQnoK0NfdoIFCRQ.png)

A new pop-up window will appear. Fill the necessary details and press _Next_.

![captionless image](https://miro.medium.com/v2/resize:fit:1090/format:webp/1*vXAWEEx2ZQEdxgiWJQ3r5w.png)

Enter a password and make sure to uncheck “_User must change password at next logon_” because we don’t want the user to change his/her password. At the same time, check the “_User cannot change password_” and “_Password never expires_” boxes.

![captionless image](https://miro.medium.com/v2/resize:fit:1090/format:webp/1*cCQwcjV3mkmMnJrDgAsWWA.png)

Press _Next → Finish_. So, now we have created our low privileged user account which we will be using as our attacker.

**Computer Account:**

We need a computer account with ‘_Un-Constrained delegation_’ privilege set in-order to abuse it. Follow the instructions for setting-up the same.

First step is exactly like the previous one but instead of choosing account type as _User_, we will selecting _Computer_ this time.

![captionless image](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*ixEJsNiUYL4IwEl5dbRx1A.png)

In the popped up windows, Enter the computer name.

![captionless image](https://miro.medium.com/v2/resize:fit:1090/format:webp/1*y4YqZK24bFxG3QxZoCxoUw.png)

One thing to note is, By default, a computer account will be assigned to be a member of ‘Domain Admins’ which we don’t want in this case. So in-order to change it, Click _Change →_ In the new pop-up windows, Enter _Domain_ and press _‘Check Names’._

![captionless image](https://miro.medium.com/v2/resize:fit:1166/format:webp/1*cOTZUlz5fj6Pm5pFNXtbIw.png)

Upon clicking ‘_Check Names’,_ a new new widows will appear where you need to Select “_Domain Computers_” → press _OK_ → _OK_.

![captionless image](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*ttr-bB5FW51-BxLyf7j_IQ.png)

Now, we have created our machine account. Let’s give it the privilege.

In the ‘_Active Directory Users and Computers_’ → Users → Find the computer account you have created [Here _Unconstrain-me_] → _Right Click_ → _Properties_.

![captionless image](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*GAP2INCv21LS_AojQrTzxQ.png)

In the popped-up window , Go to _Delegation_ → Select ‘_Trust this computer for delegation to any service_ ’ → Click _OK_.

![captionless image](https://miro.medium.com/v2/resize:fit:1166/format:webp/1*cemqZygG0Q1HcNQsRYbKZQ.png)

And yeah, that’s it !!. Our computer account is configured for Un-Constrained Delegation.

![captionless image](https://miro.medium.com/v2/resize:fit:996/format:webp/1*AKfb-x0_b-zfqrvxa8X5Ug.gif)

Let’s Check it using two ways.

1.  Using Active Directory Module from Windows.
2.  Impacket Scripts from Linux.

1.  ACTIVE DIRECTORY MODULE:

```C
Get-ADComputer -Filter {TrustedForDelegation -eq $true -and primarygroupid -eq 515} -Properties trustedfordelegation,serviceprincipalname,description
```

Use the above mentioned PowerShell query to list the computer account with “trustedfordelegation” property set.

![captionless image](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*s8n4hVB0iISABkcYXPIfCQ.png)

As we can see, the property is set.

2. IMPACKET FROM LINUX:

Finddelegation.py script from impacket will be used to check for computer accounts with unconstrained delegation set. You can get the impacket scripts from [here.](https://github.com/fortra/impacket)

![captionless image](https://miro.medium.com/v2/resize:fit:1362/format:webp/1*dz1NHKCRSPETh6uY4px9qg.png)

We have validated our (mis)configuration from both Windows and Linux. As I have already mentioned in the previous blogpost that we won’t be showcasing on how to exploit them as there are many tutorials available for the same.

In the next blog, we will see how to setup Constrained delegation. Thanks for reading.

Follow me on [LinkedIn](https://www.linkedin.com/in/dharani-sanjaiy-/), [X](https://twitter.com/DharaniSanjaiy).

Help me to get OSCP [here](https://www.buymeacoffee.com/dharanisanjaiy) :)
