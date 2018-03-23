﻿import { Emitter, EmitOptions } from '../../../src/Emitter';
import { PerFieldEmitOptions } from '../../../src/FieldEmitter';
import { PerPropertyEmitOptions } from '../../../src/PropertyEmitter';
import { PerClassEmitOptions } from '../../../src/ClassEmitter';
import { PerInterfaceEmitOptions } from '../../../src/InterfaceEmitter';
import { PerMethodEmitOptions } from '../../../src/MethodEmitter';
import { PerStructEmitOptions } from '../../../src/StructEmitter';
import { TypeEmitOptions } from '../../../src/TypeEmitter';

import {
	CSharpClass,
	CSharpInterface,
	CSharpNamespace,
	CSharpField,
	CSharpProperty
} from 'fluffy-spoon.javascript.csharp-parser';

Error.stackTraceLimit = 100;

function LegacyAdapter(contents: any, options: any) {
	var emitter = new Emitter(contents);

	var emitOptions = <EmitOptions>{
		defaults: {
			namespaceEmitOptions: {
				skip: true
			},
			fieldEmitOptions: {
				perFieldEmitOptions: (field: CSharpField) => <PerFieldEmitOptions>{
					readOnly: field.isReadOnly
				}
			},
			propertyEmitOptions: {
				perPropertyEmitOptions: (property: CSharpProperty) => <PerPropertyEmitOptions>{
					name: property.name
				}
			},
			enumEmitOptions: {}
		},
		file: {
			namespaceEmitOptions: {
				classEmitOptions: {
					propertyEmitOptions: {
						typeEmitOptions: {}
					},
					methodEmitOptions: {
						returnTypeEmitOptions: {},
						argumentTypeEmitOptions: {}
					}
				}
			},
			classEmitOptions: {
				propertyEmitOptions: {
					typeEmitOptions: {}
				},
				methodEmitOptions: {
					returnTypeEmitOptions: {},
					argumentTypeEmitOptions: {}
				}
			},
			interfaceEmitOptions: {
				propertyEmitOptions: {}
			}
		}
	};

	emitter.logger.setLogMethod((message, ...parameters) => {
		if (parameters.length > 0) {
			console.log(
				emitter.stringEmitter.currentIndentation + message,
				parameters);
		} else {
			console.log(
				emitter.stringEmitter.currentIndentation + message);
		}
	});

	if (options) {
		if (options.useStringUnionTypes) {
			emitOptions.defaults.enumEmitOptions.strategy = "string-union";
		}

		if (options.propertyNameResolver) {
			emitOptions.file.classEmitOptions.propertyEmitOptions.perPropertyEmitOptions =
				emitOptions.file.interfaceEmitOptions.propertyEmitOptions.perPropertyEmitOptions = (property) => <PerPropertyEmitOptions>{
					name: options.propertyNameResolver(property.name)
				};
		}

		if (options.methodNameResolver) {
			emitOptions.file.interfaceEmitOptions.methodEmitOptions.perMethodEmitOptions =
				emitOptions.file.classEmitOptions.methodEmitOptions.perMethodEmitOptions = (method) => <PerMethodEmitOptions>{
					name: options.methodNameResolver(method.name)
				};
		}

		let perInterfaceOrClassOptions = (input: CSharpClass | CSharpInterface) => <PerInterfaceEmitOptions | PerClassEmitOptions>{
			name: input.name,
			inheritedTypeEmitOptions: {
				mapper: (type, suggestedOutput) => suggestedOutput
			}
		};
		if (options.interfaceNameResolver) {
			perInterfaceOrClassOptions = (interfaceObject) => <PerInterfaceEmitOptions | PerClassEmitOptions>{
				name: options.interfaceNameResolver(interfaceObject.name),
				inheritedTypeEmitOptions: {
					mapper: (type, suggestedOutput) => options.interfaceNameResolver(suggestedOutput)
				}
			};

			emitOptions.file.interfaceEmitOptions.perInterfaceEmitOptions =
				emitOptions.file.classEmitOptions.perClassEmitOptions = <any>perInterfaceOrClassOptions;
		}

		if (options.prefixWithI) {
			var prefixWithIPerInterfaceOrClassOptions = perInterfaceOrClassOptions;
			perInterfaceOrClassOptions = (classObject) => <PerClassEmitOptions>{
				name: "I" + prefixWithIPerInterfaceOrClassOptions(classObject).name,
				inheritedTypeEmitOptions: {
					mapper: (type, suggested) =>
						"I" + prefixWithIPerInterfaceOrClassOptions(classObject).inheritedTypeEmitOptions.mapper(type, suggested)
				}
			};

			emitOptions.file.classEmitOptions.perClassEmitOptions =
				emitOptions.file.interfaceEmitOptions.perInterfaceEmitOptions = <any>perInterfaceOrClassOptions;
		}

		if (options.ignoreVirtual) {
			emitOptions.file.classEmitOptions.methodEmitOptions.filter = (method) => !method.isVirtual;
			emitOptions.file.classEmitOptions.propertyEmitOptions.filter = (property) => !property.isVirtual;
		}

		if (options.ignoreMethods) {
			emitOptions.file.classEmitOptions.methodEmitOptions.filter = (method) => false;
		}

		if (options.stripReadOnly) {
			emitOptions.defaults.fieldEmitOptions.perFieldEmitOptions = () => <PerFieldEmitOptions>{
				readOnly: false
			};
		}

		if (options.ignoreInheritance) {
			emitOptions.file.interfaceEmitOptions.filter = (classObject) => options.ignoreInheritance.indexOf(classObject.name) === -1;
			emitOptions.file.interfaceEmitOptions.perInterfaceEmitOptions = (interfaceObject) => <PerInterfaceEmitOptions>{
				inheritedTypeEmitOptions: {
					filter: (type) => options.ignoreInheritance.indexOf(type.name) === -1
				}
			};
			emitOptions.file.classEmitOptions.filter = (classObject) => options.ignoreInheritance.indexOf(classObject.name) === -1;
			emitOptions.file.classEmitOptions.perClassEmitOptions = (classObject) => <PerClassEmitOptions>{
				inheritedTypeEmitOptions: {
					filter: (type) => options.ignoreInheritance.indexOf(type.name) === -1
				}
			};
		}

		if (options.baseNamespace) {
			emitOptions.file.namespaceEmitOptions.skip = false;
			emitOptions.file.namespaceEmitOptions.declare = true;

			emitOptions.onAfterParsing = (file) => {
				if (file.namespaces.filter(n => n.name === options.baseNamespace)[0])
					return;

				var namespace = new CSharpNamespace(options.baseNamespace);
				namespace.classes = file.classes;
				namespace.enums = file.enums;
				namespace.innerScopeText = file.innerScopeText;
				namespace.interfaces = file.interfaces;
				namespace.namespaces = file.namespaces;
				namespace.parent = file;
				namespace.structs = file.structs;
				namespace.usings = file.usings;

				file.classes = [];
				file.enums = [];
				file.interfaces = [];
				file.namespaces = [];
				file.structs = [];
				file.usings = [];

				file.namespaces.push(namespace);
			};
		}

		if (options.dateTimeToDate) {
			emitOptions.defaults.typeEmitOptions = <TypeEmitOptions>{
				mapper: (type, suggested) => type.name === "DateTime" ? "Date" : suggested
			};
		}

		if (options.customTypeTranslations) {
			emitOptions.defaults.typeEmitOptions = <TypeEmitOptions>{
				mapper: (type, suggested) => options.customTypeTranslations[type.name] || suggested
			};
		}

		if (options.typeResolver) {
			emitOptions.file.classEmitOptions
				.propertyEmitOptions
				.typeEmitOptions
				.mapper = (type, suggested) => options.typeResolver(
					suggested,
					"property-type");
			emitOptions.file.namespaceEmitOptions
				.classEmitOptions
				.propertyEmitOptions
				.typeEmitOptions
				.mapper = (type, suggested) => options.typeResolver(
					suggested,
					"property-type");

			emitOptions.file.classEmitOptions
				.methodEmitOptions
				.returnTypeEmitOptions
				.mapper = (type, suggested) => options.typeResolver(
					suggested,
					"method-return-type");
			emitOptions.file.namespaceEmitOptions
				.classEmitOptions
				.methodEmitOptions
				.returnTypeEmitOptions
				.mapper = (type, suggested) => options.typeResolver(
					suggested,
					"method-return-type");

			emitOptions.file.classEmitOptions
				.methodEmitOptions
				.argumentTypeEmitOptions
				.mapper = (type, suggested) => options.typeResolver(
					suggested,
					"method-argument-type");
			emitOptions.file.namespaceEmitOptions
				.classEmitOptions
				.methodEmitOptions
				.argumentTypeEmitOptions
				.mapper = (type, suggested) => options.typeResolver(
					suggested,
					"method-argument-type");
		}
	}

	return emitter.emit(emitOptions);
}

export = LegacyAdapter;