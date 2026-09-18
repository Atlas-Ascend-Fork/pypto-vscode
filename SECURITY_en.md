# Security Statement

## Running User Recommendations

For security considerations, do not use administrator accounts such as root to execute any commands. Follow the principle of least privilege.

## File Permission Control

- Set the system umask value to 0027 or higher on host machines (including physical hosts) and in containers. This ensures that new folders have a default maximum permission of 750 and new files have a default maximum permission of 640.
- You should implement permission control and other security measures for sensitive content such as personal privacy data, commercial assets, and source files. For example, implement permission control for the installation directory of this project and for input public data files. Refer to [A-File (Folder) Recommended Maximum Permissions for Each Scenario](#a-file-folder-recommended-maximum-permissions-for-each-scenario) for recommended permissions.
- You should implement permission control during installation and usage. Refer to [A-File (Folder) Recommended Maximum Permissions for Each Scenario](#a-file-folder-recommended-maximum-permissions-for-each-scenario) for file permission reference when configuring settings.

## Build Security Statement

When you compile and install this project from source code, you need to compile it yourself. The compilation process generates intermediate files. It is recommended that you implement permission control for the intermediate files after compilation is complete to ensure file security.

## Running Security Statement

- It is recommended that you use this plugin in accordance with the resource conditions of the running environment. If the scale of the data you process does not match the resource conditions, errors may occur and cause the process to exit unexpectedly. Such situations include loading a large computation graph JSON file that causes memory to exceed capacity limits, or locally saved data that exceeds disk space.
- The plugin prints error messages when runtime exceptions occur. It is recommended that you locate the specific error cause based on the error messages, including reviewing log files and other methods.

## Public Network Address Statement

The public network addresses included in the code of this project are listed below:

| Type | Open Source Code Address | File Name | Public IP Address / Public URL Address / Domain / Email Address / Compressed File Address | Purpose |
| --- | --- | --- | --- | --- |
| Dependency | Not applicable | src/services/welcome/index.ts | <https://pypi.tuna.tsinghua.edu.cn/simple> | Tsinghua PyPI mirror source, used for installing pip dependencies when the welcome page initializes a Python sample project |

---

## Vulnerability Mechanism Statement

[Vulnerability Management](https://gitcode.com/cann/community/blob/master/security/security.md)

## Appendix

### A-File (Folder) Recommended Maximum Permissions for Each Scenario

| Type | Linux Permission Reference Maximum |
| --- | --- |
| User home directory | 750 (rwxr-x---) |
| Program files (including script files, library files, and so on) | 550 (r-xr-x---) |
| Program file directory | 550 (r-xr-x---) |
| Configuration file | 640 (rw-r-----) |
| Configuration file directory | 750 (rwxr-x---) |
| Log file (recording completed or archived) | 440 (r--r-----) |
| Log file (currently recording) | 640 (rw-r-----) |
| Log file directory | 750 (rwxr-x---) |
| Debug file | 640 (rw-r-----) |
| Debug file directory | 750 (rwxr-x---) |
| Temporary file directory | 750 (rwxr-x---) |
| Maintenance and upgrade file directory | 770 (rwxrwx---) |
| Business data file | 640 (rw-r-----) |
| Business data file directory | 750 (rwxr-x---) |
| Key component, private key, certificate, ciphertext file directory | 700 (rwx—----) |
| Key component, private key, certificate, encrypted ciphertext | 600 (rw-------) |
| Encryption and decryption interface, encryption and decryption script | 500 (r-x------) |
