import { expect, describe, test } from 'vitest';
import { parser as createParser, transformToSvelte } from '../../src/lib/models/parser';
import fs from 'node:fs';
import { tryToLoadJson } from './helpers';

describe('parse', () => {
	const samples = fs.readdirSync(`${__dirname}/samples`);
	for (const dir of samples) {
		if (dir[0] === '.') return;

		// add .solo to a sample directory name to only run that test
		const solo = /\.solo$/.test(dir);

		if (solo && process.env.CI) {
			throw new Error(
				`Forgot to remove '.solo' from test parser/samples/${dir}`
			);
		}

		const skip = !fs.existsSync(`${__dirname}/samples/${dir}/input.sm`);

		const runner = skip ? test.skip : solo ? test.only : test;
		runner(dir, () => {
			const input = fs
				.readFileSync(`${__dirname}/samples/${dir}/input.sm`, 'utf-8')
				.replace(/\s+$/, '')
				.replace(/\r/g, '');
			const expectedOutput = tryToLoadJson(`${__dirname}/samples/${dir}/output.json`);
			const expectedError = tryToLoadJson(`${__dirname}/samples/${dir}/error.json`);

			try {
				const parser = createParser(input);
				for (const char of input) {
					parser.emit.CHARACTER(char);
				}
				const parsed = transformToSvelte(parser);
				fs.writeFileSync(`${__dirname}/samples/${dir}/_actual.json`, JSON.stringify(parsed, null, 4));
				expect(parsed).toEqual(expectedOutput);
			} catch (err) {
				if (err.name !== 'ParseError') throw err;
				if (!expectedError) throw err;
				const { code, message, pos, start } = err;
				try {
					expect({ code, message, pos, start }).toEqual(expectedOutput);
				} catch (err2) {
					const e = err2.code === 'MODULE_NOT_FOUND' ? err : err2;
					throw e;
				}
			}
		});
	}
});
