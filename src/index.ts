import { Worker } from "@notionhq/workers";
import * as Schema from "@notionhq/workers/schema";
import { listConnections, toUpsertChanges } from "./googleContacts.js";

const worker = new Worker();
export default worker;

const googleAuth = worker.oauth("googleAuth", {
	name: "google-contacts-oauth",
	authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
	tokenEndpoint: "https://oauth2.googleapis.com/token",
	scope: "https://www.googleapis.com/auth/contacts.readonly",
	clientId: process.env.GOOGLE_CLIENT_ID ?? "",
	clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
	authorizationParams: {
		access_type: "offline",
		prompt: "consent",
	},
});

const contacts = worker.database("contacts", {
	type: "managed",
	initialTitle: "Google Contacts",
	primaryKeyProperty: "Contact ID",
	schema: {
		properties: {
			Name: Schema.title(),
			"Contact ID": Schema.richText(),
			Email: Schema.email(),
			Phone: Schema.phoneNumber(),
			Company: Schema.richText(),
			"Photo URL": Schema.url(),
		},
	},
});

const googleApi = worker.pacer("googleApi", {
	allowedRequests: 10,
	intervalMs: 1000,
});

type ContactsSyncState = {
	pageToken?: string;
};

worker.sync("contactsSync", {
	database: contacts,
	mode: "replace",
	schedule: "3h",
	execute: async (state?: ContactsSyncState) => {
		const token = await googleAuth.accessToken();
		await googleApi.wait();

		const { connections, nextPageToken } = await listConnections(token, {
			pageToken: state?.pageToken,
			pageSize: 100,
		});

		return {
			changes: toUpsertChanges(connections),
			hasMore: Boolean(nextPageToken),
			nextState: nextPageToken ? { pageToken: nextPageToken } : undefined,
		};
	},
});
