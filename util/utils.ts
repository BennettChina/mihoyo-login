import { randomBytes } from "crypto";

export function getMiHoYoUuid(): string {
	let t: string[] = [];
	const seed = "0123456789abcdef";
	for ( let n = 0; n < 36; n++ ) {
		t[n] = seed.substr( Math.floor( 16 * Math.random() ), 1 );
	}
	t[14] = "4";
	const t19 = parseInt( t[19] );
	t[19] = seed.substr( 3 & t19 | 8, 1 );
	t[8] = t[13] = t[18] = t[23] = "-";
	return t.join( "" );
}

export function deviceFp(): string {
	const seed = '0123456789';
	return randomString( 10, seed );
}

export function getMiHoYoRandomStr( length: number ): string {
	const seed = '0123456789abcdef';
	return randomString( length, seed );
}

export function batteryStatus(): number {
	const max = 100, min = 1;
	return randomInt( min, max );
}

export function randomInt( min: number, max: number ): number {
	const range: number = max - min + 1;
	return min + Math.floor( Math.random() * range );
}

/**
 * 生成一组加速计数值
 */
export function accelerometer(): number[] {
	const x = ( Math.random() - 0.5 ) * 2;
	const y = ( Math.random() - 0.5 ) * 2;
	const z = ( Math.random() - 0.5 ) * 2;
	return [ x, y, z ];
}

export function magnetometer() {
	// -90 到 90 的随机值
	const range = 180;
	const length = 3;
	return Array.from( { length }, () => {
		return Math.random() * range - range / 2;
	} );
}

export function randomStr( length: number ): string {
	const seed = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
	return randomString( length, seed );
}

function randomString( length: number, seed: string ): string {
	return Array.from( { length }, () => {
		const randNum = Math.floor( Math.random() * seed.length );
		return seed[randNum];
	} ).join( "" );
}

export function random_canvas(): string {
	const rand_png = Uint8Array.from( [
		...randomBytes( 2 ),
		0x00, 0x00, 0x00, 0x00,
		73, 69, 78, 68,
		0x00, 0xE0A0, 0x00, 0x2000
	] )
	return Buffer.from( rand_png ).toString( 'base64' );
}

export function getPlugins( size: number ): string[] {
	const plugins = [
		"PDF Viewer",
		"Chrome PDF Viewer",
		"Chromium PDF Viewer",
		"Microsoft Edge PDF Viewer",
		"WebKit built-in PDF"
	]
	
	if ( size >= plugins.length ) {
		return plugins;
	}
	return plugins.slice( 0, size - plugins.length );
}

/**
 * 随机产生一个偶数
 * @param min {number} 最小值
 * @param max {number} 最大值
 * @return {number} 偶数
 */
export function randomEvenNum( min: number, max: number ): number {
	// 确保范围内至少有一个偶数
	if ( min % 2 !== 0 ) {
		min += 1;
	}
	if ( max % 2 !== 0 ) {
		max -= 1;
	}
	// 如果调整后min大于max，说明范围内没有偶数
	if ( min > max ) {
		throw new Error( 'No even numbers in the given range.' );
	}
	
	// 随机生成一个偶数
	const range = ( max - min ) / 2 + 1;
	return min + 2 * Math.floor( Math.random() * range );
}

export function transformCookie( cookie: string ): Record<string, string>;

export function transformCookie( cookie: Record<string, string> ): string;

export function transformCookie( cookie: string | Record<string, string> ): Record<string, string> | string {
	if ( typeof cookie === "string" ) {
		return decodeURIComponent( cookie ).split( ";" )
			.filter( item => !!item && item.trim().length > 0 )
			.reduce( ( acc, item ) => {
				const delimiter = item.indexOf( '=' );
				const key = item.substring( 0, delimiter ).trim();
				acc[key] = item.substring( delimiter + 1 ).trim();
				return acc;
			}, {} );
	}
	return Object.entries( cookie )
		.map( ( [ k, v ] ) => {
			return `${ k }=${ v }`;
		} )
		.join( ";" );
}