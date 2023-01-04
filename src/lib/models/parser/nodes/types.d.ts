interface BaseNode {
	start: number;
	end: number;
	type: string;
	children?: TemplateNode[];
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

export interface Element extends BaseNode {
	type: 'Element';
	name: string;
}

export interface Invalid extends BaseNode {
	type: 'Invalid';
	error: {
		code: string,
		message: string,
	};
}

export type TemplateNode = Element | Fragment | Invalid | Text;
