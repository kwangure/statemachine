interface BaseNode {
	start: number;
	end: number;
	type: string;
	children?: TemplateNode[];
	error?: Invalid;
	[prop_name: string]: any;
}

export interface Fragment extends BaseNode {
	type: 'Fragment';
	children: TemplateNode[];
}

export interface Text extends BaseNode {
	type: 'Text';
	data: string;
}

export interface Comment extends BaseNode {
	type: 'Comment';
	data: string;
	ignores: string[];
}

export interface Element extends BaseNode {
	type: 'Element';
	name: string;
	attributes: Array<Attribute>;
	children: TemplateNode[];
}

export interface Attribute extends BaseNode {
	type: 'Attribute';
	name: string;
	value: any[] | true;
}

export interface Invalid extends BaseNode {
	type: 'Invalid';
	error: {
		code: string,
		message: string,
	};
}

export type TemplateNode = Attribute
| Comment
| Element
| Fragment
| Invalid
| Text;
