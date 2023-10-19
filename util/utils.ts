import { Md5 } from "md5-typescript";

export function ds( data: string ): string {
	// PROD salt
	const n: string = "JwYDpKvLj6MrMqqYU6jTKF17KNO2PXoS";
	const t = Date.now() / 1000 | 0;
	const r = randomStr( 6 );
	const h = Md5.init( `salt=${ n }&t=${ t }&r=${ r }&b=${ data }&q=` );
	return `${ t },${ r },${ h }`;
}

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
