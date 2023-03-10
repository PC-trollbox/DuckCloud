# DuckCloud
Free VMs for everyone. A "cloud".

## Create a DB
DB gitignored for a special purpose.
Add these contents to db.json.
```json
{}
```
Save this and then run.

## Selfhosting

Please build suspiral:
1. cd to `suspiral`
2. docker build . -t duckcloud/suspiral

[err] Experiencing no pages (just the file name)? Make sure all the .jsembeds files are symlinks!

[wrn] Terminal input on Windows might not work. If you need that for testing, please use Linux VMs (actual VMs!) or WSL.

## Administration

### PRO flags
You can get PRO on any account by using a random token. To do this, create an account called "pro_coder" and select a strong password for it,
using normal DuckCloud tools. This account can run VMs. even get PRO flag for itself. Under /manage, you'll find "PRO flag management" section, which
will have the options to create or delete PRO tokens. The tokens can be created/removed, and set to expire after activation.
You can also restrict the user from getting the PRO flag by using this feature, by setting `cannotPRO` to `true` an db.json.

### Database editing
Create a file called `db.lok`, then you can edit the database. After you have done the editing, remove `db.lok`, otherwise the site won't answer.

### Server update warning
Warn your users about a possible update by creating `duckcloud.blok`. It's ultimate, restricting any user from logging in until a restart has completed. Notice that you'll need to remove `duckcloud.blok` after updating, otherwise the site will still be blocked.

### Certified DuckCloud Technician mode
This section a Certified DuckCloud Technician mode.
To make the user certified, edit the user to include `isCertifiedTechnician` (value `true`).

## TCP Tunnelling
Use `testTCPConnect.js` for TCP tunnelling. Also check out [duckcl](https://www.npmjs.com/package/duckcloud-cli)oud-cli on npm for the `forward` command