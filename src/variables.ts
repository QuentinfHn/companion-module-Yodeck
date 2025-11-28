import type { ModuleInstance } from './main.js'

export function buildScreenVariableId(screenId: number | string): string {
	const normalized = String(screenId).replace(/[^A-Za-z0-9_]/g, '_')
	return `screen_${normalized}_current_content`
}

export function UpdateVariableDefinitions(self: ModuleInstance): void {
	const definitions = self.CHOICES_SCREENS.map((screen) => ({
		variableId: buildScreenVariableId(screen.id),
		name: `${screen.label || `Screen ${screen.id}`} current content`,
	}))

	self.setVariableDefinitions(definitions)
	self.updateScreenPlaybackVariables()
}
