import { defineDirective, InputParameter } from "@/modules/command";
import { MiHoYoLogin } from "#/mihoyo-login/module/login";

export default defineDirective( "order", async ( i: InputParameter ) => {
	const { logger, sendMessage } = i;
	const miHoYoLogin = new MiHoYoLogin( i );
	try {
		await miHoYoLogin.loginByQRCode();
	} catch ( error: any ) {
		logger.error( error )
		await sendMessage( error?.message || error );
	}
} );