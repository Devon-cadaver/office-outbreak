// The build's version, from package.json, shown in the corner of each menu so it's clear which build is running.
import { version } from '../package.json';
export const VERSION = version;
export function stampVersion(parent = document.body) { const el = document.createElement('div'); el.className = 'ver'; el.textContent = 'v' + VERSION; parent.appendChild(el); return el; }
