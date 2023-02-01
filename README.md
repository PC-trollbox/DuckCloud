# DuckCloud
Free VMs for everyone. A "cloud".

## Weaknesses
If you launch a very heavy process, the DuckCloud can "break" (kill itself or the OOM killer IDK).

After "breaking", the users will have to relaunch EVERY SINGLE VM they have created.

## Create a DB
DB gitignored for a special purpose.
Add these contents to db.json.
```json
{}
```
Save this and then run.