/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	CompletionList,
	Diagnostic,
	Position,
	Range,
} from 'vscode-languageserver';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { getSuperColliderMode } from './modes/scdMode';

export { Position, Range, TextDocument };

export interface LanguageMode {
	getId(): string;
	doValidation?: (document: TextDocument) => Diagnostic[];
	doComplete?: (document: TextDocument, position: Position) => CompletionList;
	onDocumentRemoved(document: TextDocument): void;
	dispose(): void;
}

export interface LanguageModes {
	getModeAtPosition(document: TextDocument, position: Position): LanguageMode | undefined;
	getModesInRange(document: TextDocument, range: Range): LanguageModeRange[];
	getAllModes(): LanguageMode[];
	getAllModesInDocument(document: TextDocument): LanguageMode[];
	getMode(languageId: string): LanguageMode | undefined;
	onDocumentRemoved(document: TextDocument): void;
	dispose(): void;
}

export interface LanguageModeRange extends Range {
	mode: LanguageMode | undefined;
	attributeValue?: boolean;
}

export function getLanguageModes(): LanguageModes {
	const scdMode = getSuperColliderMode();

	const modes: { [id: string]: LanguageMode } = {
		'supercollider': scdMode
	};

	return {
		getModeAtPosition(
			_document: TextDocument,
			_position: Position
		): LanguageMode | undefined {
			// SuperCollider is a single language, always return the scd mode
			return scdMode;
		},
		getModesInRange(document: TextDocument, range: Range): LanguageModeRange[] {
			// SuperCollider is a single language, return the whole range as scd
			return [{
				start: range.start,
				end: range.end,
				mode: scdMode
			}];
		},
		getAllModesInDocument(_document: TextDocument): LanguageMode[] {
			return [scdMode];
		},
		getAllModes(): LanguageMode[] {
			return Object.values(modes);
		},
		getMode(languageId: string): LanguageMode {
			return modes[languageId];
		},
		onDocumentRemoved(document: TextDocument) {
			for (const mode of Object.values(modes)) {
				mode.onDocumentRemoved(document);
			}
		},
		dispose(): void {
			for (const mode of Object.values(modes)) {
				mode.dispose();
			}
		}
	};
}
