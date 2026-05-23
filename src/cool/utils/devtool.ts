let devtoolProtectionApplied = false;

export async function applyDevtoolProtection(enabled?: boolean) {
	if (!enabled || devtoolProtectionApplied || typeof window === 'undefined') {
		return;
	}

	devtoolProtectionApplied = true;

	try {
		const DisableDevtool = await import('disable-devtool');
		DisableDevtool.default({
			rewriteHTML:
				'<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#1f2937;">Developer tools are disabled.</div>'
		});
	} catch (err) {
		devtoolProtectionApplied = false;
		console.warn('[security] disable devtool failed', err);
	}
}
