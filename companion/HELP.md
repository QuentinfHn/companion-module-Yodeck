## Overview

This Companion module lets you control Yodeck screens through the public API. Once configured you can trigger takeovers, update the default content, assign schedules, create media assets from URLs, and clear any running takeover.

## Requirements

- A Yodeck API token with permission to read and write screens, media, playlists, layouts, and schedules.
- At least one screen and the content you want to target (media, playlist, layout, or schedule).

## Configuration

1. In Companion, add the **yodeck** module.
2. Paste your Yodeck API token into the **API Key** field. The token should look like `Token label:xxxxxxxx` (the module accepts either the labelled or plain value).
3. Press **Save**. The module will immediately fetch workspaces, screens, media, playlists, layouts, and schedules to populate the dropdowns used by the actions.

If the API key is missing or invalid the instance status will show **Bad Config** or **Connection Failure**. After fixing the token click **Save** to retry.

## Available Actions

| Action                            | What it does                                                                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Take over screen with content** | Starts a takeover on a screen with selected media, playlist, or layout. You can optionally limit the duration (minimum 5 minutes). |
| **Set schedule on screen**        | Assigns one of your schedules to a screen. The screen will follow that calendar until changed again.                               |
| **Set default content on screen** | Updates the fallback content (media/playlist/layout) that plays when no schedule is running.                                       |
| **Stop takeover on screen**       | Clears any active takeover so the screen resumes scheduled/default playback.                                                       |
| **Create media from URL**         | Creates a media item (web page, image, video, audio, or document) sourced from a URL in the chosen workspace.                      |

Each action exposes dropdowns that are auto-populated from your Yodeck account. If a list is empty, confirm that your API token has access to that resource and press **Reload Variables** or **Save** on the instance to refresh.

## Variables

| Variable ID format                  | Purpose                                                                                                                                                                                                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `screen_<screenId>_current_content` | Shows what is currently playing on the selected screen (e.g. `screen_123_current_content`). Values look like `Now playing: Layout 42` or `Takeover: Alert Playlist`. Use these variables in button labels, presets, or triggers. They refresh automatically every ~30 seconds. |

## Tips

- If you add or rename content in Yodeck, click **Save** on the instance or trigger the **Reload Variables** button to refresh the cached lists.
- For takeovers, Companion sends a `screens/{id}/takeover` call followed by an immediate push so the screen updates right away.
- When assigning schedules or default content the module fetches the screen first to include its workspace info; this keeps multi-workspace setups consistent.
- Log messages from the instance show the Yodeck API responses. Use Companion's log window to diagnose permission or rate-limit errors.
