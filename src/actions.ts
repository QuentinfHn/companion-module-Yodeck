import type { CompanionInputFieldDropdown } from '@companion-module/base'
import type { ModuleInstance } from './main.js'

const MEDIA_TYPE_CHOICES = [
	{ id: 'webpage', label: 'Web Page' },
	{ id: 'image', label: 'Image' },
	{ id: 'video', label: 'Video' },
	{ id: 'audio', label: 'Audio' },
	{ id: 'document', label: 'Document' },
]

const CONTENT_TYPES = ['media', 'playlist', 'layout'] as const
type ContentType = (typeof CONTENT_TYPES)[number]
type SupportedContentType = ContentType | 'schedule'
const CONTENT_TYPE_CHOICES: { id: ContentType; label: string }[] = [
	{ id: 'media', label: 'Media' },
	{ id: 'playlist', label: 'Playlist' },
	{ id: 'layout', label: 'Layout' },
]

function withChoices(choices: { id: string | number; label: string }[]): CompanionInputFieldDropdown['choices'] {
	return choices.length > 0 ? choices : [{ id: '', label: 'No items available' }]
}

export function UpdateActions(self: ModuleInstance): void {
	const defaultContentType = inferDefaultContentType(self)

	self.setActionDefinitions({
		push_to_player: {
			name: 'Take over screen with content',
			description: 'Start a takeover on the selected screen with media, a playlist, or a layout.',
			options: [
				{
					id: 'screen_id',
					type: 'dropdown',
					label: 'Screen',
					choices: withChoices(self.CHOICES_SCREENS),
					allowCustom: false,
					default: self.CHOICES_SCREENS[0]?.id ?? '',
				},
				{
					id: 'content_type',
					type: 'dropdown',
					label: 'Content type',
					choices: CONTENT_TYPE_CHOICES,
					default: defaultContentType,
					tooltip: 'Choose whether you want to push a media item, playlist, or layout.',
				},
				{
					id: 'media_id',
					type: 'dropdown',
					label: 'Media',
					choices: withChoices(self.CHOICES_MEDIA),
					allowCustom: false,
					default: self.CHOICES_MEDIA[0]?.id ?? '',
					isVisible: (options) => options.content_type === 'media',
				},
				{
					id: 'playlist_id',
					type: 'dropdown',
					label: 'Playlist',
					choices: withChoices(self.CHOICES_PLAYLISTS),
					allowCustom: false,
					default: self.CHOICES_PLAYLISTS[0]?.id ?? '',
					isVisible: (options) => options.content_type === 'playlist',
				},
				{
					id: 'layout_id',
					type: 'dropdown',
					label: 'Layout',
					choices: withChoices(self.CHOICES_LAYOUTS),
					allowCustom: false,
					default: self.CHOICES_LAYOUTS[0]?.id ?? '',
					isVisible: (options) => options.content_type === 'layout',
				},
				{
					id: 'duration',
					type: 'number',
					label: 'Take over time (minutes, optional)',
					default: 0,
					min: 0,
					max: 1440,
				},
			],
			callback: async (event) => {
				const screenId = toNumber(event.options.screen_id)
				const selection = extractContentSelection(event.options)
				const duration = toNumber(event.options.duration)

				if (screenId === null || selection === null) {
					self.log('warn', 'Select a screen and valid content before starting a takeover')
					return
				}

				const takeoverPayload: Record<string, any> = {
					takeover_content: {
						source_id: selection.id,
						source_type: selection.type,
					},
				}

				if (duration !== null && duration >= 5) {
					takeoverPayload.takeover_content.duration = duration
				}

				try {
					await self.apiRequest(`screens/${screenId}/takeover`, {
						method: 'PUT',
						body: JSON.stringify(takeoverPayload),
					})

					await self.apiRequest(`screens/${screenId}/push`, {
						method: 'POST',
					})

					self.log('info', `Started takeover with ${selection.type} ${selection.id} on screen ${screenId}`)
				} catch (error) {
					self.log('error', `Failed to push to screen: ${String(error)}`)
				}
			},
		},
		set_schedule_on_screen: {
			name: 'Set schedule on screen',
			description: 'Assigns a schedule to the selected screen so it follows that calendar.',
			options: [
				{
					id: 'screen_id',
					type: 'dropdown',
					label: 'Screen',
					choices: withChoices(self.CHOICES_SCREENS),
					allowCustom: false,
					default: self.CHOICES_SCREENS[0]?.id ?? '',
				},
				{
					id: 'schedule_id',
					type: 'dropdown',
					label: 'Schedule',
					choices: withChoices(self.CHOICES_SCHEDULES),
					allowCustom: false,
					default: self.CHOICES_SCHEDULES[0]?.id ?? '',
				},
			],
			callback: async (event) => {
				const screenId = toNumber(event.options.screen_id)
				const scheduleId = toNumber(event.options.schedule_id)
				if (screenId === null || scheduleId === null) {
					self.log('warn', 'Select a screen and schedule before updating the screen schedule')
					return
				}

				try {
					const screenDetail = await self.apiRequest(`screens/${screenId}`)
					const sourceName = lookupSelectionLabel(self, { type: 'schedule', id: scheduleId })
					const payload: Record<string, any> = {
						screen_content: {
							source_type: 'schedule',
							source_id: scheduleId,
						},
					}

					if (sourceName) {
						payload.screen_content.source_name = sourceName
					}

					if (screenDetail?.workspace?.id) {
						payload.workspace = {
							id: screenDetail.workspace.id,
							name: screenDetail.workspace.name ?? '',
						}
					}

					await self.apiRequest(`screens/${screenId}`, {
						method: 'PATCH',
						body: JSON.stringify(payload),
					})

					await self.apiRequest(`screens/${screenId}/push`, {
						method: 'POST',
					})

					self.log('info', `Assigned schedule ${scheduleId} to screen ${screenId}`)
				} catch (error) {
					self.log('error', `Failed to assign schedule to screen: ${String(error)}`)
				}
			},
		},
		set_default_content: {
			name: 'Set default content on screen',
			description: "Updates the screen's default media/playlist/layout so it shows when no schedule runs.",
			options: [
				{
					id: 'screen_id',
					type: 'dropdown',
					label: 'Screen',
					choices: withChoices(self.CHOICES_SCREENS),
					allowCustom: false,
					default: self.CHOICES_SCREENS[0]?.id ?? '',
				},
				{
					id: 'content_type',
					type: 'dropdown',
					label: 'Content type',
					choices: CONTENT_TYPE_CHOICES,
					default: defaultContentType,
				},
				{
					id: 'media_id',
					type: 'dropdown',
					label: 'Media',
					choices: withChoices(self.CHOICES_MEDIA),
					allowCustom: false,
					default: self.CHOICES_MEDIA[0]?.id ?? '',
					isVisible: (options) => options.content_type === 'media',
				},
				{
					id: 'playlist_id',
					type: 'dropdown',
					label: 'Playlist',
					choices: withChoices(self.CHOICES_PLAYLISTS),
					allowCustom: false,
					default: self.CHOICES_PLAYLISTS[0]?.id ?? '',
					isVisible: (options) => options.content_type === 'playlist',
				},
				{
					id: 'layout_id',
					type: 'dropdown',
					label: 'Layout',
					choices: withChoices(self.CHOICES_LAYOUTS),
					allowCustom: false,
					default: self.CHOICES_LAYOUTS[0]?.id ?? '',
					isVisible: (options) => options.content_type === 'layout',
				},
			],
			callback: async (event) => {
				const screenId = toNumber(event.options.screen_id)
				const selection = extractContentSelection(event.options)
				if (screenId === null || selection === null) {
					self.log('warn', 'Select a screen and valid content before updating default content')
					return
				}

				try {
					const screenDetail = await self.apiRequest(`screens/${screenId}`)
					const sourceName = lookupSelectionLabel(self, selection)
					const payload: Record<string, any> = {
						screen_content: {
							source_type: selection.type,
							source_id: selection.id,
						},
					}

					if (sourceName) {
						payload.screen_content.source_name = sourceName
					}

					if (screenDetail?.workspace?.id) {
						payload.workspace = {
							id: screenDetail.workspace.id,
							name: screenDetail.workspace.name ?? '',
						}
					}

					await self.apiRequest(`screens/${screenId}`, {
						method: 'PATCH',
						body: JSON.stringify(payload),
					})

					await self.apiRequest(`screens/${screenId}/push`, {
						method: 'POST',
					})

					self.log('info', `Updated default content to ${selection.type} ${selection.id} on screen ${screenId}`)
				} catch (error) {
					self.log('error', `Failed to update default content: ${String(error)}`)
				}
			},
		},
		stop_takeover: {
			name: 'Stop takeover on screen',
			description: 'Clears the active takeover so the screen resumes its scheduled/default content.',
			options: [
				{
					id: 'screen_id',
					type: 'dropdown',
					label: 'Screen',
					choices: withChoices(self.CHOICES_SCREENS),
					allowCustom: false,
					default: self.CHOICES_SCREENS[0]?.id ?? '',
				},
			],
			callback: async (event) => {
				const screenId = toNumber(event.options.screen_id)
				if (screenId === null) {
					self.log('warn', 'Select a screen before stopping a takeover')
					return
				}

				try {
					await self.apiRequest(`screens/${screenId}/takeover`, {
						method: 'PUT',
						body: JSON.stringify({ takeover_content: null }),
					})
					self.log('info', `Cleared takeover on screen ${screenId}`)
				} catch (error) {
					self.log('error', `Failed to stop takeover: ${String(error)}`)
				}
			},
		},
		load_media: {
			name: 'Create media from URL',
			options: [
				{
					id: 'name',
					type: 'textinput',
					label: 'Media name',
					default: '',
				},
				{
					id: 'url',
					type: 'textinput',
					label: 'Source URL',
					default: '',
				},
				{
					id: 'media_type',
					type: 'dropdown',
					label: 'Media type',
					choices: MEDIA_TYPE_CHOICES,
					default: 'webpage',
				},
				{
					id: 'workspace_id',
					type: 'dropdown',
					label: 'Workspace',
					choices: withChoices(self.CHOICES_WORKSPACES),
					allowCustom: true,
					default: self.workspace ?? self.CHOICES_WORKSPACES[0]?.id ?? '',
				},
				{
					id: 'stream_from_url',
					type: 'checkbox',
					label: 'Treat URL as stream (video/audio only)',
					default: false,
				},
			],
			callback: async (event) => {
				const name = String(event.options.name || '').trim()
				const url = String(event.options.url || '').trim()
				const mediaType = String(event.options.media_type || 'webpage')
				const workspaceId = toNumber(event.options.workspace_id ?? self.workspace)
				const streamFromUrl = Boolean(event.options.stream_from_url)

				if (!name || !url) {
					self.log('warn', 'Name and URL are required to create media')
					return
				}

				if (workspaceId === null && self.CHOICES_WORKSPACES.length > 0 && self.CHOICES_WORKSPACES[0].id !== '') {
					self.log('warn', 'Select a workspace before creating media')
					return
				}

				const mediaArguments = buildMediaArguments(mediaType, url, streamFromUrl)

				const payload: Record<string, any> = {
					name,
					media_origin: {
						type: mediaType,
						source: 'url',
					},
					arguments: mediaArguments,
				}

				if (workspaceId !== null) {
					payload.workspace = workspaceId
				}

				try {
					await self.apiRequest('media', {
						method: 'POST',
						body: JSON.stringify(payload),
					})
					self.log('info', `Created media "${name}" (${mediaType})`)
					await self.updateVariables()
				} catch (error) {
					self.log('error', `Failed to create media: ${String(error)}`)
				}
			},
		},
	})
}

function toNumber(value: unknown): number | null {
	if (value === null || value === undefined || value === '') {
		return null
	}
	const parsed = Number(value)
	return Number.isFinite(parsed) ? parsed : null
}

function buildMediaArguments(mediaType: string, url: string, streamFromUrl: boolean): Record<string, any> {
	switch (mediaType) {
		case 'image':
		case 'document':
			return { download_from_url: url }
		case 'video':
		case 'audio':
			return streamFromUrl ? { play_from_url: url } : { download_from_url: url }
		case 'webpage':
		default:
			return { play_from_url: url }
	}
}

function extractContentSelection(options: Record<string, any>): { type: ContentType; id: number } | null {
	const contentType = isContentType(options?.content_type) ? options.content_type : null
	if (!contentType) {
		return null
	}
	const contentId = toNumber(options?.[`${contentType}_id`])
	if (contentId === null) {
		return null
	}
	return { type: contentType, id: contentId }
}

function lookupSelectionLabel(
	self: ModuleInstance,
	selection: { type: SupportedContentType; id: number },
): string | undefined {
	const choicesMap: Record<SupportedContentType, { id: string | number; label: string }[]> = {
		media: self.CHOICES_MEDIA,
		playlist: self.CHOICES_PLAYLISTS,
		layout: self.CHOICES_LAYOUTS,
		schedule: self.CHOICES_SCHEDULES,
	}

	const list = choicesMap[selection.type] ?? []
	const match = list.find((choice) => Number(choice.id) === selection.id)
	return match?.label
}

function inferDefaultContentType(self: ModuleInstance): ContentType {
	if (self.CHOICES_MEDIA.length > 0) return 'media'
	if (self.CHOICES_PLAYLISTS.length > 0) return 'playlist'
	if (self.CHOICES_LAYOUTS.length > 0) return 'layout'
	return 'media'
}

function isContentType(value: unknown): value is ContentType {
	return typeof value === 'string' && CONTENT_TYPES.includes(value as ContentType)
}
