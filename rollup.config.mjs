import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import copy from 'rollup-plugin-copy';

export default {
    input: 'service_worker.js',
    output: {
        file: 'dist/service_worker.js',
        format: 'esm'
    },
    plugins: [
        nodeResolve({
            browser: true,
            preferBuiltins: false
        }),
        commonjs(),
        copy({
            targets: [
                { src: 'manifest.json', dest: 'dist' },
                { src: 'popup.html', dest: 'dist' },
                { src: 'popup.js', dest: 'dist' },
                { src: 'icons', dest: 'dist' }
            ],
            hook: 'writeBundle'
        })
    ]
};