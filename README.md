# Browser Plugin Proxy Configuration Tutorial

[中文版](README_zh.md)

## Table of Contents
1. [Introduction](#introduction)
2. [Preparation](#preparation)
3. [Configuration Steps](#configuration-steps)
4. [Principle Explanation](#principle-explanation)
5. [Verify Configuration](#verify-configuration)

## Introduction
This tutorial aims to help users configure and use a proxy through a local area network to bypass network restrictions, achieving independent proxy configuration for browsers without affecting the system proxy. The following steps will guide you on how to access the network through a local proxy and use browser plugins to implement an independent browser proxy. **This is not just a proxy tool, but a solution set for breaking through specific organizations' blockades on certain sites.**

## Preparation
1. Run a V2Ray image client on a server that can bypass the GFW.
2. Example V2Ray service address: `http://192.168.83.231:12345`
3. Ensure you can SSH connect from your local computer to the intermediate server.
   - Example intermediate server IP address: `192.168.145.180`
   - SSH connection command: `ssh iask@192.168.145.180`

## Configuration Steps
1. Run a browser plugin on your local computer to enable an independent browser proxy.
2. Run the following command on your local computer to set up an SSH tunnel:
   ```
   ssh -L 8080:192.168.83.231:12345 iask@192.168.145.180
   ```

## Principle Explanation
1. **SSH Tunnel**:
   - Create an encrypted connection from your local machine to the SSH server (192.168.145.180).
2. **Local Port Forwarding**:
   - Open port 8080 on your local machine.
   - When data is sent to local port 8080, the SSH client forwards the data through the encrypted SSH connection to the SSH server (192.168.145.180).
   - The SSH server then forwards the data to the V2Ray server (192.168.83.231) on port 12345.

![image](https://github.com/user-attachments/assets/e0a48cf4-661d-4151-9915-6efa30821ffe)

## Verify Configuration
To confirm if port 8080 is listening normally, you can use the following command:
```
netstat -a -o -n | findstr :8080
```
This command will display the listening status of port 8080, ensuring that the SSH tunnel has been successfully established.

By following these steps, you can achieve independent proxy configuration for your browser without affecting other network settings in your system.
