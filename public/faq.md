# Moovicut frequently asked questions

## What is Moovicut?
Moovicut is a free, local-first storyboard and shot list. You edit the shots in the browser and copy prompts for Grok Imagine, Google, or any other AI image or video model.

## How does Moovicut work?
A premise becomes an ordered shot list on this device, with camera, action, lighting, sound, and continuity you can edit. Paste a prompt into the model you already use. Moovicut does not call that model.

## Does Moovicut render video?
No. It writes prompts. Nothing is rendered inside Moovicut.

## Which models does it support?
The picker offers Grok Imagine and Google. The same prompts work with any other AI image or video model. These names are prompt targets, not included accounts or rendering.

## Is an account required?
No. The storyboard stays in this browser. There is no sign-in.

## Can I import or export work?
Yes. Projects use the `shotboard.v1` JSON format. The studio can export a project or a local library backup, and it can import a compatible file. Files stay on your device.

## Is Moovicut free?
Yes. Planning, editing, and JSON export are free. There is no subscription. Optional tips open Buy Me a Coffee in a new tab. Moovicut does not take payment itself.

## Are visits counted?
Anonymous, cookieless visit counts via Cloudflare Web Analytics; storyboards never leave the device.

## Can an AI agent build a storyboard?
Yes. The default board is 5 scenes of 3 seconds (15s total). Step-by-step mode in `/studio`, or a `shots` count or `scenes` array on `POST /api/v1/storyboard` and `/mcp`, builds a custom scene list. Open `/agents` for the endpoints. No API key and no account.

## What happens if browser storage is unavailable?
The studio reports the failure instead of claiming the save worked. Export JSON if you want a copy outside the browser.

## Where is the studio?
Open `/studio`. Older studio, desktop, pricing, profile, and sign-in addresses redirect there.
