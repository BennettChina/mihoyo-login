import { InputParameter } from "@modules/command";
import { loginByQRCode } from "#mihoyo-login/util/api";

export async function main( i: InputParameter ): Promise<void> {
	await loginByQRCode( i );
}