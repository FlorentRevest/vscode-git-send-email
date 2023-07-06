# VSCode - Git Send Email

![Screenshot](/screenshot.png?raw=true "Screenshot")
 
This extension integrates VSCode with
[git-send-email](https://git-send-email.io/). It supports:

* Remembering settings like subject prefix, version number, cover letter title
  and content, number of patches, Ccs and Tos for a given HEAD
* Automatically bumping branches and series versions
* Pre-filling series with default parameters
* Generating series with `git format-patch`
* Inferring Ccs and Tos using a getMaintainer script (if available)
* Sanity-checking patches using a checkpatch script (if available)
* Interactively adding Tos and Ccs from emails found in a MAINTAINERS file (if available)
* Manually inspecting patches before sending
* Switching between branches that hold remembered series
* Sending series with `git send-email` (ultimately, you get to press the enter
  key if the command and patches looks good to you!)
* Remembering sent emails and offering links to archives of the conversations
