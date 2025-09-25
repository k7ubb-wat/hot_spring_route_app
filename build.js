import { build } from 'esbuild';
import fs from 'fs-extra';
import path from 'path';

const isDev = process.argv.includes('--dev');

const performBuild = async () => {
	try {
		const distDir = path.resolve('dist');
		const publicDir = path.resolve('public');
		
		await fs.ensureDir(distDir);
		try {
			await fs.copy(publicDir, distDir, { overwrite: true });
		} catch (err) {
			console.warn(`⚠️ Could not overwrite public files (ignored): ${err.message}`);
		}
		
		await build({
			bundle: true,
			format: 'esm',
			platform: 'browser',
			entryPoints: ['src/main.ts'],
			outfile: 'dist/bundle.js'
		});
		console.log('✅ Build completed successfully');
	} catch (error) {
		console.error('❌ Build failed:', error);
	}
};

if (isDev) {
	console.log('🚀 Starting development mode...');
	await performBuild();

	const watchDirs = ['src', 'public'];
	watchDirs.forEach(dir => {
		fs.watch(dir, { recursive: true }, async (eventType, filename) => {
			if (filename) {
				console.log(`🔄 Public file ${eventType}: ${filename}`);
				await performBuild();
			}
		});
	});
} else {
	try {
		await performBuild();
		process.exit(0);
	} catch {
		process.exit(1);
	}
}
