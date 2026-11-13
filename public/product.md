# Moovicut product guide

## Local planning

Moovicut uses a deterministic local story engine. Enter a premise, choose a prompt target, and generate a starting shot list. The picker offers Grok Imagine and Google. The prompts work with Grok Imagine, Google, or any other AI image or video model. Every cinematic field remains editable.

The studio supports shot insertion, deletion, and movement; undo and redo; model-specific prompt regeneration; prompt copying; and project save, import, and export. The `shotboard.v1` JSON document is flat: its `shots` array is at the top level, and each shot has a stable ID and numeric order.

## Storage

Saved projects stay in this browser. Export a JSON file to share or back up a project. The studio can also export or restore a local library backup of saved projects. Deleting a saved project asks for confirmation. There is no remote copy.

## Accounts

There is no account and no profile page. The storyboard stays in this browser.

## Price

Planning, editing, and JSON export are free. Moovicut does not sell plans or subscriptions. Optional tips open https://buymeacoffee.com/enzoc1977r in a new tab. Moovicut does not take payment itself. The old `/pricing` address redirects to `/studio`.

## Output

Moovicut prepares editable prompts and storyboard documents. It does not render video, and it does not synchronize work across devices.
