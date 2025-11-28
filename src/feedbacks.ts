import { combineRgb } from '@companion-module/base'
import type { ModuleInstance } from './main.js'

function withChoices(choices: { id: string | number; label: string }[]) {
	return choices.length > 0 ? choices : [{ id: '', label: 'No items available' }]
}

export function UpdateFeedbacks(self: ModuleInstance): void {
	self.setFeedbackDefinitions({
		screen_current_content: {
			name: 'Screen now playing content',
			type: 'advanced',
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
			callback: (feedback) => {
				const screenId = Number(feedback.options.screen_id)
				if (!Number.isFinite(screenId)) {
					return { text: 'Select a screen' }
				}

				const playback = self.getScreenPlaybackState(screenId)
				if (!playback || !playback.active) {
					return { text: 'No playback data' }
				}

				const label = playback.active.source_name
					? playback.active.source_name
					: `${playback.active.source_type ?? 'content'} ${playback.active.source_id ?? ''}`.trim()
				const prefix = playback.takeoverActive ? 'Takeover' : 'Now playing'

				return {
					text: `${prefix}: ${label}`,
					bgcolor: playback.takeoverActive ? combineRgb(255, 128, 0) : undefined,
					color: playback.takeoverActive ? combineRgb(0, 0, 0) : undefined,
				}
			},
		},
	})
}
