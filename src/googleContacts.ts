import * as Builder from "@notionhq/workers/builder";

const PEOPLE_API_BASE = "https://people.googleapis.com/v1";
const PERSON_FIELDS =
	"names,emailAddresses,phoneNumbers,organizations,photos";

export type GooglePerson = {
	resourceName?: string;
	names?: Array<{
		displayName?: string;
		givenName?: string;
		familyName?: string;
		metadata?: { primary?: boolean };
	}>;
	emailAddresses?: Array<{
		value?: string;
		metadata?: { primary?: boolean };
	}>;
	phoneNumbers?: Array<{
		value?: string;
		metadata?: { primary?: boolean };
	}>;
	organizations?: Array<{
		name?: string;
		title?: string;
		metadata?: { primary?: boolean };
	}>;
	photos?: Array<{
		url?: string;
		metadata?: { primary?: boolean };
	}>;
};

type ConnectionsResponse = {
	connections?: GooglePerson[];
	nextPageToken?: string;
};

export type ListConnectionsOptions = {
	pageToken?: string;
	pageSize?: number;
};

export type ListConnectionsResult = {
	connections: GooglePerson[];
	nextPageToken?: string;
};

export async function listConnections(
	accessToken: string,
	options: ListConnectionsOptions = {},
): Promise<ListConnectionsResult> {
	const pageSize = options.pageSize ?? 100;
	const params = new URLSearchParams({
		personFields: PERSON_FIELDS,
		pageSize: String(pageSize),
	});
	if (options.pageToken) {
		params.set("pageToken", options.pageToken);
	}

	const response = await fetch(
		`${PEOPLE_API_BASE}/people/me/connections?${params.toString()}`,
		{
			headers: { Authorization: `Bearer ${accessToken}` },
		},
	);

	if (!response.ok) {
		const body = await response.text();
		throw new Error(
			`Google People API error ${response.status}: ${body || response.statusText}`,
		);
	}

	const data = (await response.json()) as ConnectionsResponse;
	return {
		connections: data.connections ?? [],
		nextPageToken: data.nextPageToken,
	};
}

function pickPrimary<T extends { metadata?: { primary?: boolean } }>(
	items: T[] | undefined,
): T | undefined {
	if (!items?.length) return undefined;
	return items.find((item) => item.metadata?.primary) ?? items[0];
}

export function getDisplayName(person: GooglePerson): string {
	const name = pickPrimary(person.names);
	if (name?.displayName?.trim()) return name.displayName.trim();
	const parts = [name?.givenName, name?.familyName].filter(Boolean);
	if (parts.length) return parts.join(" ").trim();
	return "Unnamed Contact";
}

export function getPrimaryEmail(person: GooglePerson): string {
	return pickPrimary(person.emailAddresses)?.value?.trim() ?? "";
}

export function getPrimaryPhone(person: GooglePerson): string {
	return pickPrimary(person.phoneNumbers)?.value?.trim() ?? "";
}

export function getPrimaryCompany(person: GooglePerson): string {
	const org = pickPrimary(person.organizations);
	if (!org) return "";
	const name = org.name?.trim() ?? "";
	const title = org.title?.trim() ?? "";
	if (name && title) return `${name} — ${title}`;
	return name || title;
}

export function getPrimaryPhotoUrl(person: GooglePerson): string {
	return pickPrimary(person.photos)?.url?.trim() ?? "";
}

export function getContactKey(person: GooglePerson): string | undefined {
	const key = person.resourceName?.trim();
	return key || undefined;
}

export type ContactUpsertChange = {
	type: "upsert";
	key: string;
	properties: {
		Name: ReturnType<typeof Builder.title>;
		"Contact ID": ReturnType<typeof Builder.richText>;
		Email: ReturnType<typeof Builder.email>;
		Phone: ReturnType<typeof Builder.phoneNumber>;
		Company: ReturnType<typeof Builder.richText>;
		"Photo URL": ReturnType<typeof Builder.url>;
	};
};

export function toUpsertChange(person: GooglePerson): ContactUpsertChange | null {
	const key = getContactKey(person);
	if (!key) return null;

	return {
		type: "upsert",
		key,
		properties: {
			Name: Builder.title(getDisplayName(person)),
			"Contact ID": Builder.richText(key),
			Email: Builder.email(getPrimaryEmail(person)),
			Phone: Builder.phoneNumber(getPrimaryPhone(person)),
			Company: Builder.richText(getPrimaryCompany(person)),
			"Photo URL": Builder.url(getPrimaryPhotoUrl(person)),
		},
	};
}

export function toUpsertChanges(
	connections: GooglePerson[],
): ContactUpsertChange[] {
	return connections
		.map(toUpsertChange)
		.filter((change): change is ContactUpsertChange => change !== null);
}
