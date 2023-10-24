import { definePlugin } from "@/modules/plugin";
import cfgList from "./commands";

export default definePlugin( {
	name: "miHoYo登录",
	cfgList,
	repo: {
		owner: "BennettChina",
		repoName: "mihoyo-login",
		ref: "v3"
	},
	async mounted( params ) {
		params.setAlias( [ "米游社登录" ] );
	}
} )