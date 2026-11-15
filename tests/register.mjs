// Lets node resolve the bare 'three' specifiers (as the browser import map does) to the vendored copy.
import { register } from 'node:module';
register('./three-hooks.mjs', import.meta.url);
