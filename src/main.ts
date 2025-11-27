import { InstanceBase, runEntrypoint, InstanceStatus, SomeCompanionConfigField } from '@companion-module/base'
import { GetConfigFields, type ModuleConfig } from './config.js'
import { UpdateVariableDefinitions } from './variables.js'
import { UpgradeScripts } from './upgrades.js'
import { UpdateActions } from './actions.js'
import { UpdateFeedbacks } from './feedbacks.js'

type DropdownChoice = {
	id: number | string
	label: string
}

type HeaderCollection = Record<string, string>

interface ApiRequestOptions extends RequestInit {
	query?: Record<string, string | number | boolean | undefined>
}

export class ModuleInstance extends InstanceBase<ModuleConfig> {
	config!: ModuleConfig

	CHOICES_WORKSPACES: DropdownChoice[] = []
	CHOICES_SCREENS: DropdownChoice[] = []
	CHOICES_MEDIA: DropdownChoice[] = []
	CHOICES_PLAYLISTS: DropdownChoice[] = []
	CHOICES_LAYOUTS: DropdownChoice[] = []
	workspace: number | null = null

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig): Promise<void> {
		this.config = config
		this.updateStatus(InstanceStatus.Connecting)
		await this.updateVariables()
	}

	async destroy(): Promise<void> {
		this.log('debug', 'destroy')
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		this.config = config
		await this.updateVariables()
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return GetConfigFields()
	}

	updateActions(): void {
		UpdateActions(this)
	}

	updateFeedbacks(): void {
		UpdateFeedbacks(this)
	}

	updateVariableDefinitions(): void {
		UpdateVariableDefinitions(this)
	}

	async updateVariables(): Promise<void> {
		if (!this.config.apiKey) {
			this.updateStatus(InstanceStatus.BadConfig)
			return
		}

		this.CHOICES_WORKSPACES = []
		this.CHOICES_SCREENS = []
		this.CHOICES_MEDIA = []
		this.CHOICES_PLAYLISTS = []
		this.CHOICES_LAYOUTS = []

		try {
			const [workspacesResult, screensResult, mediaResult, playlistsResult, layoutsResult] = await Promise.allSettled([
				this.apiRequest('workspaces', { query: { limit: 100, ordering: 'name' } }),
				this.apiRequest('screens', { query: { limit: 100, ordering: 'name' } }),
				this.apiRequest('media', { query: { limit: 100, ordering: 'name' } }),
				this.apiRequest('playlists', { query: { limit: 100, ordering: 'name' } }),
				this.apiRequest('layouts', { query: { limit: 100, ordering: 'name' } }),
			])

			const screens = this.extractListFromResult(screensResult, 'screens')
			const media = this.extractListFromResult(mediaResult, 'media')
			const playlists = this.extractOptionalList(playlistsResult, 'playlists')
			const layouts = this.extractOptionalList(layoutsResult, 'layouts')

			let workspaces: any[] = []
			if (workspacesResult.status === 'fulfilled') {
				workspaces = this.extractResults(workspacesResult.value)
			} else {
				const reason = workspacesResult.reason ? String(workspacesResult.reason) : 'unknown reason'
				this.log('debug', `Workspaces endpoint unavailable (${reason}). Falling back to derived list.`)
			}

			if (workspaces.length === 0) {
				workspaces = this.deriveWorkspacesFrom(screens, media, playlists, layouts)
			}

			this.populateWorkspaceChoices(workspaces)

			this.CHOICES_SCREENS = screens.map((screen: any) => ({
				id: screen.id,
				label: screen.name || `Screen ${screen.id}`,
			}))

			this.CHOICES_MEDIA = media.map((item: any) => ({
				id: item.id,
				label: item.name || `Media ${item.id}`,
			}))

			this.CHOICES_PLAYLISTS = playlists.map((playlist: any) => ({
				id: playlist.id,
				label: playlist.name || `Playlist ${playlist.id}`,
			}))

			this.CHOICES_LAYOUTS = layouts.map((layout: any) => ({
				id: layout.id,
				label: layout.name || `Layout ${layout.id}`,
			}))

			this.updateStatus(InstanceStatus.Ok)
		} catch (error) {
			this.updateStatus(InstanceStatus.ConnectionFailure)
			this.log('error', `Failed to update choices: ${String(error)}`)
		}

		this.updateActions()
		this.updateFeedbacks()
		this.updateVariableDefinitions()
	}

	private extractListFromResult(result: PromiseSettledResult<any>, label: string): any[] {
		if (result.status === 'fulfilled') {
			return this.extractResults(result.value)
		}
		throw new Error(`Unable to load ${label}: ${String(result.reason)}`)
	}

	private extractOptionalList(result: PromiseSettledResult<any>, label: string): any[] {
		if (result.status === 'fulfilled') {
			return this.extractResults(result.value)
		}
		const reason = result.status === 'rejected' ? String(result.reason) : 'unknown reason'
		this.log('debug', `Skipping ${label} list (${reason})`)
		return []
	}

	private deriveWorkspacesFrom(screens: any[], media: any[], playlists: any[], layouts: any[]): any[] {
		const map = new Map<number, string>()
		for (const screen of screens) {
			const workspace = screen?.workspace
			if (workspace?.id && !map.has(workspace.id)) {
				map.set(workspace.id, workspace.name || `Workspace ${workspace.id}`)
			}
		}
		for (const item of media) {
			const workspace = item?.workspace
			if (workspace?.id && !map.has(workspace.id)) {
				map.set(workspace.id, workspace.name || `Workspace ${workspace.id}`)
			}
		}
		for (const playlist of playlists) {
			const workspace = playlist?.workspace
			if (workspace?.id && !map.has(workspace.id)) {
				map.set(workspace.id, workspace.name || `Workspace ${workspace.id}`)
			}
		}
		for (const layout of layouts) {
			const workspace = layout?.workspace
			if (workspace?.id && !map.has(workspace.id)) {
				map.set(workspace.id, workspace.name || `Workspace ${workspace.id}`)
			}
		}
		return Array.from(map.entries()).map(([id, label]) => ({ id, label }))
	}

	private populateWorkspaceChoices(workspaces: any[]): void {
		if (workspaces.length > 0) {
			this.CHOICES_WORKSPACES = workspaces.map((workspace: any) => ({
				id: workspace.id,
				label: workspace.name || `Workspace ${workspace.id}`,
			}))

			const stillValid = this.workspace && this.CHOICES_WORKSPACES.some((choice) => choice.id === this.workspace)
			this.workspace = stillValid ? this.workspace : (this.CHOICES_WORKSPACES[0].id as number)
			return
		}

		this.CHOICES_WORKSPACES = [{ id: '', label: 'Account default workspace' }]
		this.workspace = null
	}

	private extractResults(data: any): any[] {
		if (Array.isArray(data)) {
			return data
		}
		if (data && Array.isArray(data.results)) {
			return data.results
		}
		return []
	}

	async apiRequest(endpoint: string, options: ApiRequestOptions = {}): Promise<any> {
		const baseUrl = new URL(`https://app.yodeck.com/api/v2/${endpoint}`)
		if (options.query) {
			for (const [key, value] of Object.entries(options.query)) {
				if (value === undefined || value === null) continue
				baseUrl.searchParams.append(key, String(value))
			}
		}

		const headers: HeaderCollection = {
			Authorization: `Token ${this.config.apiKey}`,
			Accept: 'application/json',
			'Content-Type': 'application/json',
		}

		if (options.headers) {
			const source = options.headers as unknown
			if (Array.isArray(source)) {
				for (const [key, value] of source) {
					headers[key] = value
				}
			} else if (typeof (source as any) === 'object' && typeof (source as any).forEach === 'function') {
				;(source as { forEach: (callback: (value: string, key: string) => void) => void }).forEach(
					(value: string, key: string) => {
						headers[key] = value
					},
				)
			} else {
				Object.assign(headers, source as HeaderCollection)
			}
		}

		const { query: _query, ...fetchOptions } = options

		const response = await fetch(baseUrl, {
			...fetchOptions,
			headers,
		})

		if (!response.ok) {
			const errorDetail = await this.readResponseBody(response)
			const suffix = errorDetail ? ` - ${errorDetail}` : ''
			throw new Error(
				`Request to ${baseUrl.pathname}${baseUrl.search} failed with status ${response.status} ${response.statusText}${suffix}`,
			)
		}

		if (response.status === 204) {
			return null
		}

		const contentType = response.headers.get('content-type') || ''
		if (contentType.includes('application/json')) {
			return await response.json()
		}

		return await response.text()
	}

	private async readResponseBody(response: Response): Promise<string> {
		try {
			const data: any = await response.json()
			const apiError = data?.error
			if (apiError) {
				const parts: string[] = []
				if (apiError.message) {
					parts.push(apiError.message)
				}
				const extra: string[] = []
				if (apiError.code) {
					extra.push(`code=${apiError.code}`)
				}
				const reason = apiError.details?.reason
				if (reason) {
					extra.push(`reason=${reason}`)
				} else if (apiError.details) {
					extra.push(`details=${JSON.stringify(apiError.details)}`)
				}
				if (extra.length > 0) {
					parts.push(`(${extra.join(', ')})`)
				}
				return parts.join(' ').trim() || JSON.stringify(apiError)
			}
			return JSON.stringify(data)
		} catch (_error) {
			try {
				return await response.text()
			} catch (innerError) {
				return String(innerError)
			}
		}
	}
}

runEntrypoint(ModuleInstance, UpgradeScripts)
