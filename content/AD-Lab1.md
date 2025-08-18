---
title: "Build It Before Breaking It !!"                                        
date: "17-09-2023"          
excerpt: "So, You want to be a red teamer? Then You have to create your small Active Directory Home Lab right now!"                                                            
readTime: "05 min read"
tags: ["active-directory", "kerberos", "red-team"]
author: "WaterBucket"
---

Build It Before Breaking It !!
==============================

So, You want to be a red teamer? Then You have to create your small Active Directory Home Lab right now! Remember if you want to break it, You have to build it!!

This is the first post in the series “Creating your own Active Directory Lab” that I will be continuing in the upcoming weeks.

In this blog, I will be helping you to setup a couple of attacks that are possible because of clicking couple of check boxes that you should be aware of before clicking (Mis-configurations) that you will be encountering while doing your pentests :)

We will be setting up the following attacks in this post.

1.  Asrep-Roasting
2.  Kerberoasting
3.  DC Sync

Let’s get started!

I am running Windows Server 2019 as my Domain Controller and Kali Linux as my attacking VM. You can download the windows server from [here](https://www.microsoft.com/en-us/evalcenter/download-windows-server-2019).

**NOTE: I am using evaluation version of windows server and I have already added the “Active Directory Domain Services” feature. There are plenty of videos available online on ‘How to setup Active Directory’.**

**Make sure that both DC and Kali are in same network.**

**ASREP-ROASTING:**

First Login as Administrator. Open _Server Manager → Tools → Active Directory Users and Computers._

![On the Top right corner](https://miro.medium.com/v2/resize:fit:1022/format:webp/1*Q9h1UrYDFtP_xfII25bBDA.png)

On the _Active Directory & Computers_ window, click _view → Advanced Features ._

![APT.LOCAL is my forest name.](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*B8mh_37ZMOPHf7__CsxhMg.png)

First let’s create a test user account because we need a successful bind in order to perform these attacks. I am going to create a test user named “_Test_” with the password as “_P@ssw0rd_”. Follow the instructions for creating the same.

Expand your _forest_ (Here _APT.LOCAL_) → Right click on _New_ → _Users_. It will pop-up another windows, Enter the details and create a user.

![captionless image](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*mB7fnjSkX3JaUKFtV3h7Lw.png)![captionless image](https://miro.medium.com/v2/resize:fit:1088/format:webp/1*H6-OcUDWhKUGoNowjmiJIA.png)

Click Next. Enter your password and before clicking Finish, Uncheck _User must change password on next logon_ and check the next two options.

![captionless image](https://miro.medium.com/v2/resize:fit:1088/format:webp/1*lHqx6aZFgyaWEaTcq6Z82g.png)

To check if it’s created or not, Press the refresh button in _Active Directory Users & Computers Windows_ or Enter the following command in PowerShell or Command prompt.

```C
net user /domain
```
![captionless image](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*TklFq0vqTWdIef7ipHudfg.png)

You can also create an user via Command-Line using the below command.

```C
net user test 'P@ssw0rd' /add /domain
```

Let’s make it vulnerable to Asrep-roast now :)

Go to _Active Directory Users & Computers_ → _Users → Account You created (in my case “test”) → Right click and press properties._

![captionless image](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*blrNR_VNIxIAohtMur_M9w.png)

On the new popped up window, Go to _Account_ and check ‘_Do not require Kerberos pre-authentication_’ box.

![That’s it :)](https://miro.medium.com/v2/resize:fit:1030/format:webp/1*Ff6FPwT2SFbXbYhj-lWrBQ.png)

Let’s see if we can exploit it or not . Spin up your kali VM , I will be using Impacket scripts for exploitation purposes. You can get the scripts from [here](https://github.com/fortra/impacket).

Add the domain names, hostname of your DC to your hosts file which is located in _/etc/hosts._ Use the following command to test and request the password hash for _test_ user.

```C
impacket-GetNPUsers apt.local/test:'P@ssw0rd' -request

```
![captionless image](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*gKnURYK2zx3I2SiuCf1Fxw.png)

This blog is about setting up the environment so I won’t be discussing how this script works or how to exploit them. Let’s move to next misconfiguration.

**KERBEROASTING:**

I am going to create another user account called “Kerberoast-me” for demonstration purpose. Follow the same instructions that we did earlier for creating one.

Now, in-order to make it vulnerable, _Right click on the user account_ → _properties_ → _Attribute Editor_ → Look for _servicePrincipalName_ and add a new attribute by using the correct syntax. For example _“http/FQDN”_

![every account is vulnerable if it has SPN set. Make sure to use a super strong pass :)](https://miro.medium.com/v2/resize:fit:1024/format:webp/1*9tT00_YSRJ-rMYJM0ubjCw.png)

That’s it !! Yeah, this account is vulnerable to kerberoasting now.

Now , Let’s check . Go to your Linux VM and enter the following command.

```C
impacket-GetUserSPNs apt.local/test:'P@ssw0rd' -request
```
![captionless image](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*DQXp7PWxNgNSEzCA0c7GUA.png)

**DC Sync:**

Once again, I am going to create a new user account named _“DCSync-Me”_ for doing this attack.

In order to make it vulnerable, Go to _Active Directory users & Computers_ → Right click on the _domain name_ (_APT.LOCAL_ in my case) → click _properties_ → _Security_ → _Advanced_.

![captionless image](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*t-Et8PWWxgfJIwzNiBr4vA.png)![captionless image](https://miro.medium.com/v2/resize:fit:1010/format:webp/1*Wg3d_R5PkfSGtVRiCgirRw.png)

On the new popped-up window, click _Add_ → click _select a principal_

![captionless image](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*9fazcgDQjw0jj8YCVPShaQ.png)![captionless image](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*WZ61RGzc1z8aGMhwKAUaiA.png)

Add the user account name that you created and click _“check names”._ Click ok once done.

Next scroll through the Permissions and check the boxes as follows.

![captionless image](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*3dPVsvad3JQaYQnj0j3LQQ.png)

Click ok , Apply and Finish. That’s it !! It is vulnerable to DCSync now :)

Let’s check.

Type the following command in your Linux VM.

```C
impacket-secretsdump apt.local/dcsync-me:'P@ssw0rd'@192.168.182.159
```
![captionless image](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*zLMZZ7yT271iFtqw-uIcgA.png)

OK. That’s it for this blog. In next post we will see how to setup delegation based attacks such as Constrained & Unconstrained delegation etc.

Feel free to text me on [LinkedIn](https://www.linkedin.com/in/dharani-sanjaiy-/), [Twitter](https://twitter.com/DharaniSanjaiy) or Discord if you are facing any issues setting it up.

