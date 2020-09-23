import { format } from 'util';
import { FORMAT_XLIFF12, FILETYPE_XLIFF12 } from '../api/constants';
import { DOMUtilities } from './dom-utilities';
import { XliffTransUnit } from './xliff-trans-unit';
import { AbstractTranslationMessagesFile } from './abstract-translation-messages-file';
/**
 * Created by martin on 23.02.2017.
 * Ab xliff file read from a source file.
 * Defines some relevant get and set method for reading and modifying such a file.
 */
export class XliffFile extends AbstractTranslationMessagesFile {
    /**
     * Create an xlf-File from source.
     * @param xmlString source read from file.
     * @param path Path to file
     * @param encoding optional encoding of the xml.
     * This is read from the file, but if you know it before, you can avoid reading the file twice.
     * @return XliffFile
     */
    constructor(xmlString, path, encoding, optionalMaster) {
        super();
        this._warnings = [];
        this._numberOfTransUnitsWithMissingId = 0;
        this.initializeFromContent(xmlString, path, encoding, optionalMaster);
    }
    initializeFromContent(xmlString, path, encoding, optionalMaster) {
        this.parseContent(xmlString, path, encoding, optionalMaster);
        const xliffList = this._parsedDocument.getElementsByTagName('xliff');
        if (xliffList.length !== 1) {
            throw new Error(format('File "%s" seems to be no xliff file (should contain an xliff element)', path));
        }
        else {
            const version = xliffList.item(0).getAttribute('version');
            const expectedVersion = '1.2';
            if (version !== expectedVersion) {
                throw new Error(format('File "%s" seems to be no xliff 1.2 file, version should be %s, found %s', path, expectedVersion, version));
            }
        }
        return this;
    }
    /**
     * File format as it is used in config files.
     * Currently 'xlf', 'xmb', 'xmb2'
     * Returns one of the constants FORMAT_..
     */
    i18nFormat() {
        return FORMAT_XLIFF12;
    }
    /**
     * File type.
     * Here 'XLIFF 1.2'
     */
    fileType() {
        return FILETYPE_XLIFF12;
    }
    /**
     * return tag names of all elements that have mixed content.
     * These elements will not be beautified.
     * Typical candidates are source and target.
     */
    elementsWithMixedContent() {
        return ['source', 'target', 'tool', 'seg-source', 'g', 'ph', 'bpt', 'ept', 'it', 'sub', 'mrk'];
    }
    initializeTransUnits() {
        this.transUnits = [];
        const transUnitsInFile = this._parsedDocument.getElementsByTagName('trans-unit');
        for (let i = 0; i < transUnitsInFile.length; i++) {
            const transunit = transUnitsInFile.item(i);
            const id = transunit.getAttribute('id');
            if (!id) {
                this._warnings.push(format('oops, trans-unit without "id" found in master, please check file %s', this._filename));
            }
            this.transUnits.push(new XliffTransUnit(transunit, id, this));
        }
        if (this._parsedOptionalMasterDocument) {
            this.optionalMasterTransUnits = [];
            // if we has an optional master document we push the optional master transunits to the array
            const transUnitsInOptionalMasterFile = this._parsedOptionalMasterDocument.getElementsByTagName('trans-unit');
            for (let i = 0; i < transUnitsInOptionalMasterFile.length; i++) {
                const transunit = transUnitsInOptionalMasterFile.item(i);
                const id = transunit.getAttribute('id');
                if (!id) {
                    this._warnings.push(format('oops, trans-unit without "id" found in master, please check file %s', this._filename));
                }
                this.optionalMasterTransUnits.push(new XliffTransUnit(transunit, id, this));
            }
        }
    }
    /**
     * Get source language.
     * @return source language.
     */
    sourceLanguage() {
        const fileElem = DOMUtilities.getFirstElementByTagName(this._parsedDocument, 'file');
        if (fileElem) {
            return fileElem.getAttribute('source-language');
        }
        else {
            return null;
        }
    }
    /**
     * Edit the source language.
     * @param language language
     */
    setSourceLanguage(language) {
        const fileElem = DOMUtilities.getFirstElementByTagName(this._parsedDocument, 'file');
        if (fileElem) {
            fileElem.setAttribute('source-language', language);
        }
    }
    /**
     * Get target language.
     * @return target language.
     */
    targetLanguage() {
        const fileElem = DOMUtilities.getFirstElementByTagName(this._parsedDocument, 'file');
        if (fileElem) {
            return fileElem.getAttribute('target-language');
        }
        else {
            return null;
        }
    }
    /**
     * Edit the target language.
     * @param language language
     */
    setTargetLanguage(language) {
        const fileElem = DOMUtilities.getFirstElementByTagName(this._parsedDocument, 'file');
        if (fileElem) {
            fileElem.setAttribute('target-language', language);
        }
    }
    /**
     * Add a new trans-unit to this file.
     * The trans unit stems from another file.
     * It copies the source content of the tu to the target content too,
     * depending on the values of isDefaultLang and copyContent.
     * So the source can be used as a dummy translation.
     * (used by xliffmerge)
     * @param foreignTransUnit the trans unit to be imported.
     * @param isDefaultLang Flag, wether file contains the default language.
     * Then source and target are just equal.
     * The content will be copied.
     * State will be final.
     * @param copyContent Flag, wether to copy content or leave it empty.
     * Wben true, content will be copied from source.
     * When false, content will be left empty (if it is not the default language).
     * @param importAfterElement optional (since 1.10) other transunit (part of this file), that should be used as ancestor.
     * Newly imported trans unit is then inserted directly after this element.
     * If not set or not part of this file, new unit will be imported at the end.
     * If explicity set to null, new unit will be imported at the start.
     * @return the newly imported trans unit (since version 1.7.0)
     * @throws an error if trans-unit with same id already is in the file.
     */
    importNewTransUnit(foreignTransUnit, isDefaultLang, copyContent, importAfterElement) {
        if (this.transUnitWithId(foreignTransUnit.id)) {
            throw new Error(format('tu with id %s already exists in file, cannot import it', foreignTransUnit.id));
        }
        const newTu = foreignTransUnit.cloneWithSourceAsTarget(isDefaultLang, copyContent, this);
        const bodyElement = DOMUtilities.getFirstElementByTagName(this._parsedDocument, 'body');
        if (!bodyElement) {
            throw new Error(format('File "%s" seems to be no xliff 1.2 file (should contain a body element)', this._filename));
        }
        let inserted = false;
        let isAfterElementPartOfFile = false;
        if (!!importAfterElement) {
            const insertionPoint = this.transUnitWithId(importAfterElement.id);
            if (!!insertionPoint) {
                isAfterElementPartOfFile = true;
            }
        }
        if (importAfterElement === undefined || (importAfterElement && !isAfterElementPartOfFile)) {
            bodyElement.appendChild(newTu.asXmlElement());
            inserted = true;
        }
        else if (importAfterElement === null) {
            const firstUnitElement = DOMUtilities.getFirstElementByTagName(this._parsedDocument, 'trans-unit');
            if (firstUnitElement) {
                DOMUtilities.insertBefore(newTu.asXmlElement(), firstUnitElement);
                inserted = true;
            }
            else {
                // no trans-unit, empty file, so add to body
                bodyElement.appendChild(newTu.asXmlElement());
                inserted = true;
            }
        }
        else {
            const refUnitElement = DOMUtilities.getElementByTagNameAndId(this._parsedDocument, 'trans-unit', importAfterElement.id);
            if (refUnitElement) {
                DOMUtilities.insertAfter(newTu.asXmlElement(), refUnitElement);
                inserted = true;
            }
        }
        if (inserted) {
            this.lazyInitializeTransUnits();
            this.transUnits.push(newTu);
            this.countNumbers();
            return newTu;
        }
        else {
            return null;
        }
    }
    /**
     * Create a new translation file for this file for a given language.
     * Normally, this is just a copy of the original one.
     * But for XMB the translation file has format 'XTB'.
     * @param lang Language code
     * @param filename expected filename to store file
     * @param isDefaultLang Flag, wether file contains the default language.
     * Then source and target are just equal.
     * The content will be copied.
     * State will be final.
     * @param copyContent Flag, wether to copy content or leave it empty.
     * Wben true, content will be copied from source.
     * When false, content will be left empty (if it is not the default language).
     */
    createTranslationFileForLang(lang, filename, isDefaultLang, copyContent, optionalMaster) {
        const translationFile = new XliffFile(this.editedContent(), filename, this.encoding(), optionalMaster);
        translationFile.setNewTransUnitTargetPraefix(this.targetPraefix);
        translationFile.setNewTransUnitTargetSuffix(this.targetSuffix);
        translationFile.setTargetLanguage(lang);
        translationFile.forEachTransUnit((transUnit) => {
            transUnit.useSourceAsTarget(isDefaultLang, copyContent);
        });
        if (optionalMaster && translationFile.optionalMasterTransUnits && translationFile.optionalMasterTransUnits.length > 0) {
            // If optional master is specified we will iterate the master transunits and remove from translation file if they already exist in the master
            translationFile.optionalMasterTransUnits.forEach(unit => {
                const tranUnit = translationFile.transUnitWithId(unit.id);
                if (tranUnit) {
                    translationFile.removeTransUnitWithId(tranUnit.id);
                }
            });
        }
        return translationFile;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieGxpZmYtZmlsZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3Byb2plY3RzL25neC1pMThuc3VwcG9ydC1saWIvc3JjL2ltcGwveGxpZmYtZmlsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBRzlCLE9BQU8sRUFBRSxjQUFjLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUNwRSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQ3BELE9BQU8sRUFBRSwrQkFBK0IsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBRXZGOzs7O0dBSUc7QUFFSCxNQUFNLE9BQU8sU0FBVSxTQUFRLCtCQUErQjtJQUUxRDs7Ozs7OztPQU9HO0lBQ0gsWUFBWSxTQUFpQixFQUFFLElBQVksRUFBRSxRQUFnQixFQUFFLGNBQXVFO1FBQ2xJLEtBQUssRUFBRSxDQUFDO1FBQ1IsSUFBSSxDQUFDLFNBQVMsR0FBRyxFQUFFLENBQUM7UUFDcEIsSUFBSSxDQUFDLGdDQUFnQyxHQUFHLENBQUMsQ0FBQztRQUMxQyxJQUFJLENBQUMscUJBQXFCLENBQUMsU0FBUyxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsY0FBYyxDQUFDLENBQUM7SUFDMUUsQ0FBQztJQUVPLHFCQUFxQixDQUFDLFNBQWlCLEVBQUUsSUFBWSxFQUFFLFFBQWdCLEVBQUUsY0FBdUU7UUFDcEosSUFBSSxDQUFDLFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRSxjQUFjLENBQUMsQ0FBQztRQUM3RCxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLG9CQUFvQixDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQ3JFLElBQUksU0FBUyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7WUFDeEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxNQUFNLENBQUMsdUVBQXVFLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztTQUMxRzthQUFNO1lBQ0gsTUFBTSxPQUFPLEdBQUcsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDMUQsTUFBTSxlQUFlLEdBQUcsS0FBSyxDQUFDO1lBQzlCLElBQUksT0FBTyxLQUFLLGVBQWUsRUFBRTtnQkFDN0IsTUFBTSxJQUFJLEtBQUssQ0FBQyxNQUFNLENBQUMseUVBQXlFLEVBQzVGLElBQUksRUFBRSxlQUFlLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQzthQUN4QztTQUNKO1FBQ0QsT0FBTyxJQUFJLENBQUM7SUFDaEIsQ0FBQztJQUVEOzs7O09BSUc7SUFDSSxVQUFVO1FBQ2IsT0FBTyxjQUFjLENBQUM7SUFDMUIsQ0FBQztJQUVEOzs7T0FHRztJQUNJLFFBQVE7UUFDWCxPQUFPLGdCQUFnQixDQUFDO0lBQzVCLENBQUM7SUFFRDs7OztPQUlHO0lBQ08sd0JBQXdCO1FBQzlCLE9BQU8sQ0FBQyxRQUFRLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxZQUFZLEVBQUUsR0FBRyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDbkcsQ0FBQztJQUVTLG9CQUFvQjtRQUMxQixJQUFJLENBQUMsVUFBVSxHQUFHLEVBQUUsQ0FBQztRQUNyQixNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsb0JBQW9CLENBQUMsWUFBWSxDQUFDLENBQUM7UUFFakYsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLGdCQUFnQixDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtZQUM5QyxNQUFNLFNBQVMsR0FBRyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDM0MsTUFBTSxFQUFFLEdBQUcsU0FBUyxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUN4QyxJQUFJLENBQUMsRUFBRSxFQUFFO2dCQUNMLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxxRUFBcUUsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQzthQUN0SDtZQUNELElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksY0FBYyxDQUFDLFNBQVMsRUFBRSxFQUFFLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztTQUNqRTtRQUVELElBQUksSUFBSSxDQUFDLDZCQUE2QixFQUFFO1lBQ3BDLElBQUksQ0FBQyx3QkFBd0IsR0FBRyxFQUFFLENBQUM7WUFDbkMsNEZBQTRGO1lBQzVGLE1BQU0sOEJBQThCLEdBQUcsSUFBSSxDQUFDLDZCQUE2QixDQUFDLG9CQUFvQixDQUFDLFlBQVksQ0FBQyxDQUFDO1lBQzdHLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyw4QkFBOEIsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxFQUFFLEVBQUU7Z0JBQzVELE1BQU0sU0FBUyxHQUFHLDhCQUE4QixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDekQsTUFBTSxFQUFFLEdBQUcsU0FBUyxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQztnQkFDeEMsSUFBSSxDQUFDLEVBQUUsRUFBRTtvQkFDTCxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMscUVBQXFFLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7aUJBQ3RIO2dCQUNELElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxjQUFjLENBQUMsU0FBUyxFQUFFLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO2FBQy9FO1NBQ0o7SUFDTCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0ksY0FBYztRQUNqQixNQUFNLFFBQVEsR0FBRyxZQUFZLENBQUMsd0JBQXdCLENBQUMsSUFBSSxDQUFDLGVBQWUsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUNyRixJQUFJLFFBQVEsRUFBRTtZQUNWLE9BQU8sUUFBUSxDQUFDLFlBQVksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1NBQ25EO2FBQU07WUFDSCxPQUFPLElBQUksQ0FBQztTQUNmO0lBQ0wsQ0FBQztJQUVEOzs7T0FHRztJQUNJLGlCQUFpQixDQUFDLFFBQWdCO1FBQ3JDLE1BQU0sUUFBUSxHQUFHLFlBQVksQ0FBQyx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsZUFBZSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ3JGLElBQUksUUFBUSxFQUFFO1lBQ1YsUUFBUSxDQUFDLFlBQVksQ0FBQyxpQkFBaUIsRUFBRSxRQUFRLENBQUMsQ0FBQztTQUN0RDtJQUNMLENBQUM7SUFFRDs7O09BR0c7SUFDSSxjQUFjO1FBQ2pCLE1BQU0sUUFBUSxHQUFHLFlBQVksQ0FBQyx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsZUFBZSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQ3JGLElBQUksUUFBUSxFQUFFO1lBQ1YsT0FBTyxRQUFRLENBQUMsWUFBWSxDQUFDLGlCQUFpQixDQUFDLENBQUM7U0FDbkQ7YUFBTTtZQUNILE9BQU8sSUFBSSxDQUFDO1NBQ2Y7SUFDTCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0ksaUJBQWlCLENBQUMsUUFBZ0I7UUFDckMsTUFBTSxRQUFRLEdBQUcsWUFBWSxDQUFDLHdCQUF3QixDQUFDLElBQUksQ0FBQyxlQUFlLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDckYsSUFBSSxRQUFRLEVBQUU7WUFDVixRQUFRLENBQUMsWUFBWSxDQUFDLGlCQUFpQixFQUFFLFFBQVEsQ0FBQyxDQUFDO1NBQ3REO0lBQ0wsQ0FBQztJQUVEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7T0FxQkc7SUFDSCxrQkFBa0IsQ0FBQyxnQkFBNEIsRUFBRSxhQUFzQixFQUFFLFdBQW9CLEVBQUUsa0JBQStCO1FBRTFILElBQUksSUFBSSxDQUFDLGVBQWUsQ0FBQyxnQkFBZ0IsQ0FBQyxFQUFFLENBQUMsRUFBRTtZQUMzQyxNQUFNLElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQyx3REFBd0QsRUFBRSxnQkFBZ0IsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1NBQzFHO1FBQ0QsTUFBTSxLQUFLLEdBQXVCLGdCQUFpQixDQUFDLHVCQUF1QixDQUFDLGFBQWEsRUFBRSxXQUFXLEVBQUUsSUFBSSxDQUFDLENBQUM7UUFDOUcsTUFBTSxXQUFXLEdBQUcsWUFBWSxDQUFDLHdCQUF3QixDQUFDLElBQUksQ0FBQyxlQUFlLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDeEYsSUFBSSxDQUFDLFdBQVcsRUFBRTtZQUNkLE1BQU0sSUFBSSxLQUFLLENBQUMsTUFBTSxDQUFDLHlFQUF5RSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDO1NBQ3RIO1FBQ0QsSUFBSSxRQUFRLEdBQUcsS0FBSyxDQUFDO1FBQ3JCLElBQUksd0JBQXdCLEdBQUcsS0FBSyxDQUFDO1FBQ3JDLElBQUksQ0FBQyxDQUFDLGtCQUFrQixFQUFFO1lBQ3RCLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsa0JBQWtCLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDbkUsSUFBSSxDQUFDLENBQUMsY0FBYyxFQUFFO2dCQUNsQix3QkFBd0IsR0FBRyxJQUFJLENBQUM7YUFDbkM7U0FDSjtRQUNELElBQUksa0JBQWtCLEtBQUssU0FBUyxJQUFJLENBQUMsa0JBQWtCLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxFQUFFO1lBQ3ZGLFdBQVcsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUM7WUFDOUMsUUFBUSxHQUFHLElBQUksQ0FBQztTQUNuQjthQUFNLElBQUksa0JBQWtCLEtBQUssSUFBSSxFQUFFO1lBQ3BDLE1BQU0sZ0JBQWdCLEdBQUcsWUFBWSxDQUFDLHdCQUF3QixDQUFDLElBQUksQ0FBQyxlQUFlLEVBQUUsWUFBWSxDQUFDLENBQUM7WUFDbkcsSUFBSSxnQkFBZ0IsRUFBRTtnQkFDbEIsWUFBWSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsWUFBWSxFQUFFLEVBQUUsZ0JBQWdCLENBQUMsQ0FBQztnQkFDbEUsUUFBUSxHQUFHLElBQUksQ0FBQzthQUNuQjtpQkFBTTtnQkFDSCw0Q0FBNEM7Z0JBQzVDLFdBQVcsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLFlBQVksRUFBRSxDQUFDLENBQUM7Z0JBQzlDLFFBQVEsR0FBRyxJQUFJLENBQUM7YUFDbkI7U0FDSjthQUFNO1lBQ0gsTUFBTSxjQUFjLEdBQUcsWUFBWSxDQUFDLHdCQUF3QixDQUFDLElBQUksQ0FBQyxlQUFlLEVBQUUsWUFBWSxFQUFFLGtCQUFrQixDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQ3hILElBQUksY0FBYyxFQUFFO2dCQUNoQixZQUFZLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxZQUFZLEVBQUUsRUFBRSxjQUFjLENBQUMsQ0FBQztnQkFDL0QsUUFBUSxHQUFHLElBQUksQ0FBQzthQUNuQjtTQUNKO1FBQ0QsSUFBSSxRQUFRLEVBQUU7WUFDVixJQUFJLENBQUMsd0JBQXdCLEVBQUUsQ0FBQztZQUNoQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUM1QixJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDcEIsT0FBTyxLQUFLLENBQUM7U0FDaEI7YUFBTTtZQUNILE9BQU8sSUFBSSxDQUFDO1NBQ2Y7SUFDTCxDQUFDO0lBRUQ7Ozs7Ozs7Ozs7Ozs7T0FhRztJQUNJLDRCQUE0QixDQUFDLElBQVksRUFBRSxRQUFnQixFQUFFLGFBQXNCLEVBQUUsV0FBb0IsRUFBRSxjQUF1RTtRQUdyTCxNQUFNLGVBQWUsR0FBRyxJQUFJLFNBQVMsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLEVBQUUsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsRUFBRSxjQUFjLENBQUMsQ0FBQztRQUN2RyxlQUFlLENBQUMsNEJBQTRCLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBQ2pFLGVBQWUsQ0FBQywyQkFBMkIsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDL0QsZUFBZSxDQUFDLGlCQUFpQixDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3hDLGVBQWUsQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLFNBQXFCLEVBQUUsRUFBRTtZQUNuQyxTQUFVLENBQUMsaUJBQWlCLENBQUMsYUFBYSxFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBQ2pGLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxjQUFjLElBQUksZUFBZSxDQUFDLHdCQUF3QixJQUFJLGVBQWUsQ0FBQyx3QkFBd0IsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1lBQ25ILDZJQUE2STtZQUM3SSxlQUFlLENBQUMsd0JBQXdCLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUNwRCxNQUFNLFFBQVEsR0FBRyxlQUFlLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQztnQkFDMUQsSUFBSSxRQUFRLEVBQUU7b0JBQ1YsZUFBZSxDQUFDLHFCQUFxQixDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQztpQkFDdEQ7WUFDTCxDQUFDLENBQUMsQ0FBQztTQUNOO1FBRUQsT0FBTyxlQUFlLENBQUM7SUFDM0IsQ0FBQztDQUNKIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZm9ybWF0IH0gZnJvbSAndXRpbCc7XHJcbmltcG9ydCB7IElUcmFuc2xhdGlvbk1lc3NhZ2VzRmlsZSB9IGZyb20gJy4uL2FwaS9pLXRyYW5zbGF0aW9uLW1lc3NhZ2VzLWZpbGUnO1xyXG5pbXBvcnQgeyBJVHJhbnNVbml0IH0gZnJvbSAnLi4vYXBpL2ktdHJhbnMtdW5pdCc7XHJcbmltcG9ydCB7IEZPUk1BVF9YTElGRjEyLCBGSUxFVFlQRV9YTElGRjEyIH0gZnJvbSAnLi4vYXBpL2NvbnN0YW50cyc7XHJcbmltcG9ydCB7IERPTVV0aWxpdGllcyB9IGZyb20gJy4vZG9tLXV0aWxpdGllcyc7XHJcbmltcG9ydCB7IFhsaWZmVHJhbnNVbml0IH0gZnJvbSAnLi94bGlmZi10cmFucy11bml0JztcclxuaW1wb3J0IHsgQWJzdHJhY3RUcmFuc2xhdGlvbk1lc3NhZ2VzRmlsZSB9IGZyb20gJy4vYWJzdHJhY3QtdHJhbnNsYXRpb24tbWVzc2FnZXMtZmlsZSc7XHJcbmltcG9ydCB7IEFic3RyYWN0VHJhbnNVbml0IH0gZnJvbSAnLi9hYnN0cmFjdC10cmFucy11bml0JztcclxuLyoqXHJcbiAqIENyZWF0ZWQgYnkgbWFydGluIG9uIDIzLjAyLjIwMTcuXHJcbiAqIEFiIHhsaWZmIGZpbGUgcmVhZCBmcm9tIGEgc291cmNlIGZpbGUuXHJcbiAqIERlZmluZXMgc29tZSByZWxldmFudCBnZXQgYW5kIHNldCBtZXRob2QgZm9yIHJlYWRpbmcgYW5kIG1vZGlmeWluZyBzdWNoIGEgZmlsZS5cclxuICovXHJcblxyXG5leHBvcnQgY2xhc3MgWGxpZmZGaWxlIGV4dGVuZHMgQWJzdHJhY3RUcmFuc2xhdGlvbk1lc3NhZ2VzRmlsZSBpbXBsZW1lbnRzIElUcmFuc2xhdGlvbk1lc3NhZ2VzRmlsZSB7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGUgYW4geGxmLUZpbGUgZnJvbSBzb3VyY2UuXHJcbiAgICAgKiBAcGFyYW0geG1sU3RyaW5nIHNvdXJjZSByZWFkIGZyb20gZmlsZS5cclxuICAgICAqIEBwYXJhbSBwYXRoIFBhdGggdG8gZmlsZVxyXG4gICAgICogQHBhcmFtIGVuY29kaW5nIG9wdGlvbmFsIGVuY29kaW5nIG9mIHRoZSB4bWwuXHJcbiAgICAgKiBUaGlzIGlzIHJlYWQgZnJvbSB0aGUgZmlsZSwgYnV0IGlmIHlvdSBrbm93IGl0IGJlZm9yZSwgeW91IGNhbiBhdm9pZCByZWFkaW5nIHRoZSBmaWxlIHR3aWNlLlxyXG4gICAgICogQHJldHVybiBYbGlmZkZpbGVcclxuICAgICAqL1xyXG4gICAgY29uc3RydWN0b3IoeG1sU3RyaW5nOiBzdHJpbmcsIHBhdGg6IHN0cmluZywgZW5jb2Rpbmc6IHN0cmluZywgb3B0aW9uYWxNYXN0ZXI/OiB7IHhtbENvbnRlbnQ6IHN0cmluZywgcGF0aDogc3RyaW5nLCBlbmNvZGluZzogc3RyaW5nIH0pIHtcclxuICAgICAgICBzdXBlcigpO1xyXG4gICAgICAgIHRoaXMuX3dhcm5pbmdzID0gW107XHJcbiAgICAgICAgdGhpcy5fbnVtYmVyT2ZUcmFuc1VuaXRzV2l0aE1pc3NpbmdJZCA9IDA7XHJcbiAgICAgICAgdGhpcy5pbml0aWFsaXplRnJvbUNvbnRlbnQoeG1sU3RyaW5nLCBwYXRoLCBlbmNvZGluZywgb3B0aW9uYWxNYXN0ZXIpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgaW5pdGlhbGl6ZUZyb21Db250ZW50KHhtbFN0cmluZzogc3RyaW5nLCBwYXRoOiBzdHJpbmcsIGVuY29kaW5nOiBzdHJpbmcsIG9wdGlvbmFsTWFzdGVyPzogeyB4bWxDb250ZW50OiBzdHJpbmcsIHBhdGg6IHN0cmluZywgZW5jb2Rpbmc6IHN0cmluZyB9KTogWGxpZmZGaWxlIHtcclxuICAgICAgICB0aGlzLnBhcnNlQ29udGVudCh4bWxTdHJpbmcsIHBhdGgsIGVuY29kaW5nLCBvcHRpb25hbE1hc3Rlcik7XHJcbiAgICAgICAgY29uc3QgeGxpZmZMaXN0ID0gdGhpcy5fcGFyc2VkRG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ3hsaWZmJyk7XHJcbiAgICAgICAgaWYgKHhsaWZmTGlzdC5sZW5ndGggIT09IDEpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGZvcm1hdCgnRmlsZSBcIiVzXCIgc2VlbXMgdG8gYmUgbm8geGxpZmYgZmlsZSAoc2hvdWxkIGNvbnRhaW4gYW4geGxpZmYgZWxlbWVudCknLCBwYXRoKSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgY29uc3QgdmVyc2lvbiA9IHhsaWZmTGlzdC5pdGVtKDApLmdldEF0dHJpYnV0ZSgndmVyc2lvbicpO1xyXG4gICAgICAgICAgICBjb25zdCBleHBlY3RlZFZlcnNpb24gPSAnMS4yJztcclxuICAgICAgICAgICAgaWYgKHZlcnNpb24gIT09IGV4cGVjdGVkVmVyc2lvbikge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGZvcm1hdCgnRmlsZSBcIiVzXCIgc2VlbXMgdG8gYmUgbm8geGxpZmYgMS4yIGZpbGUsIHZlcnNpb24gc2hvdWxkIGJlICVzLCBmb3VuZCAlcycsXHJcbiAgICAgICAgICAgICAgICAgICAgcGF0aCwgZXhwZWN0ZWRWZXJzaW9uLCB2ZXJzaW9uKSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBGaWxlIGZvcm1hdCBhcyBpdCBpcyB1c2VkIGluIGNvbmZpZyBmaWxlcy5cclxuICAgICAqIEN1cnJlbnRseSAneGxmJywgJ3htYicsICd4bWIyJ1xyXG4gICAgICogUmV0dXJucyBvbmUgb2YgdGhlIGNvbnN0YW50cyBGT1JNQVRfLi5cclxuICAgICAqL1xyXG4gICAgcHVibGljIGkxOG5Gb3JtYXQoKTogc3RyaW5nIHtcclxuICAgICAgICByZXR1cm4gRk9STUFUX1hMSUZGMTI7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBGaWxlIHR5cGUuXHJcbiAgICAgKiBIZXJlICdYTElGRiAxLjInXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBmaWxlVHlwZSgpOiBzdHJpbmcge1xyXG4gICAgICAgIHJldHVybiBGSUxFVFlQRV9YTElGRjEyO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogcmV0dXJuIHRhZyBuYW1lcyBvZiBhbGwgZWxlbWVudHMgdGhhdCBoYXZlIG1peGVkIGNvbnRlbnQuXHJcbiAgICAgKiBUaGVzZSBlbGVtZW50cyB3aWxsIG5vdCBiZSBiZWF1dGlmaWVkLlxyXG4gICAgICogVHlwaWNhbCBjYW5kaWRhdGVzIGFyZSBzb3VyY2UgYW5kIHRhcmdldC5cclxuICAgICAqL1xyXG4gICAgcHJvdGVjdGVkIGVsZW1lbnRzV2l0aE1peGVkQ29udGVudCgpOiBzdHJpbmdbXSB7XHJcbiAgICAgICAgcmV0dXJuIFsnc291cmNlJywgJ3RhcmdldCcsICd0b29sJywgJ3NlZy1zb3VyY2UnLCAnZycsICdwaCcsICdicHQnLCAnZXB0JywgJ2l0JywgJ3N1YicsICdtcmsnXTtcclxuICAgIH1cclxuXHJcbiAgICBwcm90ZWN0ZWQgaW5pdGlhbGl6ZVRyYW5zVW5pdHMoKSB7XHJcbiAgICAgICAgdGhpcy50cmFuc1VuaXRzID0gW107XHJcbiAgICAgICAgY29uc3QgdHJhbnNVbml0c0luRmlsZSA9IHRoaXMuX3BhcnNlZERvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCd0cmFucy11bml0Jyk7XHJcblxyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdHJhbnNVbml0c0luRmlsZS5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBjb25zdCB0cmFuc3VuaXQgPSB0cmFuc1VuaXRzSW5GaWxlLml0ZW0oaSk7XHJcbiAgICAgICAgICAgIGNvbnN0IGlkID0gdHJhbnN1bml0LmdldEF0dHJpYnV0ZSgnaWQnKTtcclxuICAgICAgICAgICAgaWYgKCFpZCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fd2FybmluZ3MucHVzaChmb3JtYXQoJ29vcHMsIHRyYW5zLXVuaXQgd2l0aG91dCBcImlkXCIgZm91bmQgaW4gbWFzdGVyLCBwbGVhc2UgY2hlY2sgZmlsZSAlcycsIHRoaXMuX2ZpbGVuYW1lKSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdGhpcy50cmFuc1VuaXRzLnB1c2gobmV3IFhsaWZmVHJhbnNVbml0KHRyYW5zdW5pdCwgaWQsIHRoaXMpKTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICh0aGlzLl9wYXJzZWRPcHRpb25hbE1hc3RlckRvY3VtZW50KSB7XHJcbiAgICAgICAgICAgIHRoaXMub3B0aW9uYWxNYXN0ZXJUcmFuc1VuaXRzID0gW107XHJcbiAgICAgICAgICAgIC8vIGlmIHdlIGhhcyBhbiBvcHRpb25hbCBtYXN0ZXIgZG9jdW1lbnQgd2UgcHVzaCB0aGUgb3B0aW9uYWwgbWFzdGVyIHRyYW5zdW5pdHMgdG8gdGhlIGFycmF5XHJcbiAgICAgICAgICAgIGNvbnN0IHRyYW5zVW5pdHNJbk9wdGlvbmFsTWFzdGVyRmlsZSA9IHRoaXMuX3BhcnNlZE9wdGlvbmFsTWFzdGVyRG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ3RyYW5zLXVuaXQnKTtcclxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0cmFuc1VuaXRzSW5PcHRpb25hbE1hc3RlckZpbGUubGVuZ3RoOyBpKyspIHtcclxuICAgICAgICAgICAgICAgIGNvbnN0IHRyYW5zdW5pdCA9IHRyYW5zVW5pdHNJbk9wdGlvbmFsTWFzdGVyRmlsZS5pdGVtKGkpO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgaWQgPSB0cmFuc3VuaXQuZ2V0QXR0cmlidXRlKCdpZCcpO1xyXG4gICAgICAgICAgICAgICAgaWYgKCFpZCkge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3dhcm5pbmdzLnB1c2goZm9ybWF0KCdvb3BzLCB0cmFucy11bml0IHdpdGhvdXQgXCJpZFwiIGZvdW5kIGluIG1hc3RlciwgcGxlYXNlIGNoZWNrIGZpbGUgJXMnLCB0aGlzLl9maWxlbmFtZSkpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICAgICAgdGhpcy5vcHRpb25hbE1hc3RlclRyYW5zVW5pdHMucHVzaChuZXcgWGxpZmZUcmFuc1VuaXQodHJhbnN1bml0LCBpZCwgdGhpcykpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogR2V0IHNvdXJjZSBsYW5ndWFnZS5cclxuICAgICAqIEByZXR1cm4gc291cmNlIGxhbmd1YWdlLlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgc291cmNlTGFuZ3VhZ2UoKTogc3RyaW5nIHtcclxuICAgICAgICBjb25zdCBmaWxlRWxlbSA9IERPTVV0aWxpdGllcy5nZXRGaXJzdEVsZW1lbnRCeVRhZ05hbWUodGhpcy5fcGFyc2VkRG9jdW1lbnQsICdmaWxlJyk7XHJcbiAgICAgICAgaWYgKGZpbGVFbGVtKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBmaWxlRWxlbS5nZXRBdHRyaWJ1dGUoJ3NvdXJjZS1sYW5ndWFnZScpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEVkaXQgdGhlIHNvdXJjZSBsYW5ndWFnZS5cclxuICAgICAqIEBwYXJhbSBsYW5ndWFnZSBsYW5ndWFnZVxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgc2V0U291cmNlTGFuZ3VhZ2UobGFuZ3VhZ2U6IHN0cmluZykge1xyXG4gICAgICAgIGNvbnN0IGZpbGVFbGVtID0gRE9NVXRpbGl0aWVzLmdldEZpcnN0RWxlbWVudEJ5VGFnTmFtZSh0aGlzLl9wYXJzZWREb2N1bWVudCwgJ2ZpbGUnKTtcclxuICAgICAgICBpZiAoZmlsZUVsZW0pIHtcclxuICAgICAgICAgICAgZmlsZUVsZW0uc2V0QXR0cmlidXRlKCdzb3VyY2UtbGFuZ3VhZ2UnLCBsYW5ndWFnZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogR2V0IHRhcmdldCBsYW5ndWFnZS5cclxuICAgICAqIEByZXR1cm4gdGFyZ2V0IGxhbmd1YWdlLlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgdGFyZ2V0TGFuZ3VhZ2UoKTogc3RyaW5nIHtcclxuICAgICAgICBjb25zdCBmaWxlRWxlbSA9IERPTVV0aWxpdGllcy5nZXRGaXJzdEVsZW1lbnRCeVRhZ05hbWUodGhpcy5fcGFyc2VkRG9jdW1lbnQsICdmaWxlJyk7XHJcbiAgICAgICAgaWYgKGZpbGVFbGVtKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBmaWxlRWxlbS5nZXRBdHRyaWJ1dGUoJ3RhcmdldC1sYW5ndWFnZScpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEVkaXQgdGhlIHRhcmdldCBsYW5ndWFnZS5cclxuICAgICAqIEBwYXJhbSBsYW5ndWFnZSBsYW5ndWFnZVxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgc2V0VGFyZ2V0TGFuZ3VhZ2UobGFuZ3VhZ2U6IHN0cmluZykge1xyXG4gICAgICAgIGNvbnN0IGZpbGVFbGVtID0gRE9NVXRpbGl0aWVzLmdldEZpcnN0RWxlbWVudEJ5VGFnTmFtZSh0aGlzLl9wYXJzZWREb2N1bWVudCwgJ2ZpbGUnKTtcclxuICAgICAgICBpZiAoZmlsZUVsZW0pIHtcclxuICAgICAgICAgICAgZmlsZUVsZW0uc2V0QXR0cmlidXRlKCd0YXJnZXQtbGFuZ3VhZ2UnLCBsYW5ndWFnZSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQWRkIGEgbmV3IHRyYW5zLXVuaXQgdG8gdGhpcyBmaWxlLlxyXG4gICAgICogVGhlIHRyYW5zIHVuaXQgc3RlbXMgZnJvbSBhbm90aGVyIGZpbGUuXHJcbiAgICAgKiBJdCBjb3BpZXMgdGhlIHNvdXJjZSBjb250ZW50IG9mIHRoZSB0dSB0byB0aGUgdGFyZ2V0IGNvbnRlbnQgdG9vLFxyXG4gICAgICogZGVwZW5kaW5nIG9uIHRoZSB2YWx1ZXMgb2YgaXNEZWZhdWx0TGFuZyBhbmQgY29weUNvbnRlbnQuXHJcbiAgICAgKiBTbyB0aGUgc291cmNlIGNhbiBiZSB1c2VkIGFzIGEgZHVtbXkgdHJhbnNsYXRpb24uXHJcbiAgICAgKiAodXNlZCBieSB4bGlmZm1lcmdlKVxyXG4gICAgICogQHBhcmFtIGZvcmVpZ25UcmFuc1VuaXQgdGhlIHRyYW5zIHVuaXQgdG8gYmUgaW1wb3J0ZWQuXHJcbiAgICAgKiBAcGFyYW0gaXNEZWZhdWx0TGFuZyBGbGFnLCB3ZXRoZXIgZmlsZSBjb250YWlucyB0aGUgZGVmYXVsdCBsYW5ndWFnZS5cclxuICAgICAqIFRoZW4gc291cmNlIGFuZCB0YXJnZXQgYXJlIGp1c3QgZXF1YWwuXHJcbiAgICAgKiBUaGUgY29udGVudCB3aWxsIGJlIGNvcGllZC5cclxuICAgICAqIFN0YXRlIHdpbGwgYmUgZmluYWwuXHJcbiAgICAgKiBAcGFyYW0gY29weUNvbnRlbnQgRmxhZywgd2V0aGVyIHRvIGNvcHkgY29udGVudCBvciBsZWF2ZSBpdCBlbXB0eS5cclxuICAgICAqIFdiZW4gdHJ1ZSwgY29udGVudCB3aWxsIGJlIGNvcGllZCBmcm9tIHNvdXJjZS5cclxuICAgICAqIFdoZW4gZmFsc2UsIGNvbnRlbnQgd2lsbCBiZSBsZWZ0IGVtcHR5IChpZiBpdCBpcyBub3QgdGhlIGRlZmF1bHQgbGFuZ3VhZ2UpLlxyXG4gICAgICogQHBhcmFtIGltcG9ydEFmdGVyRWxlbWVudCBvcHRpb25hbCAoc2luY2UgMS4xMCkgb3RoZXIgdHJhbnN1bml0IChwYXJ0IG9mIHRoaXMgZmlsZSksIHRoYXQgc2hvdWxkIGJlIHVzZWQgYXMgYW5jZXN0b3IuXHJcbiAgICAgKiBOZXdseSBpbXBvcnRlZCB0cmFucyB1bml0IGlzIHRoZW4gaW5zZXJ0ZWQgZGlyZWN0bHkgYWZ0ZXIgdGhpcyBlbGVtZW50LlxyXG4gICAgICogSWYgbm90IHNldCBvciBub3QgcGFydCBvZiB0aGlzIGZpbGUsIG5ldyB1bml0IHdpbGwgYmUgaW1wb3J0ZWQgYXQgdGhlIGVuZC5cclxuICAgICAqIElmIGV4cGxpY2l0eSBzZXQgdG8gbnVsbCwgbmV3IHVuaXQgd2lsbCBiZSBpbXBvcnRlZCBhdCB0aGUgc3RhcnQuXHJcbiAgICAgKiBAcmV0dXJuIHRoZSBuZXdseSBpbXBvcnRlZCB0cmFucyB1bml0IChzaW5jZSB2ZXJzaW9uIDEuNy4wKVxyXG4gICAgICogQHRocm93cyBhbiBlcnJvciBpZiB0cmFucy11bml0IHdpdGggc2FtZSBpZCBhbHJlYWR5IGlzIGluIHRoZSBmaWxlLlxyXG4gICAgICovXHJcbiAgICBpbXBvcnROZXdUcmFuc1VuaXQoZm9yZWlnblRyYW5zVW5pdDogSVRyYW5zVW5pdCwgaXNEZWZhdWx0TGFuZzogYm9vbGVhbiwgY29weUNvbnRlbnQ6IGJvb2xlYW4sIGltcG9ydEFmdGVyRWxlbWVudD86IElUcmFuc1VuaXQpXHJcbiAgICAgICAgOiBJVHJhbnNVbml0IHtcclxuICAgICAgICBpZiAodGhpcy50cmFuc1VuaXRXaXRoSWQoZm9yZWlnblRyYW5zVW5pdC5pZCkpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGZvcm1hdCgndHUgd2l0aCBpZCAlcyBhbHJlYWR5IGV4aXN0cyBpbiBmaWxlLCBjYW5ub3QgaW1wb3J0IGl0JywgZm9yZWlnblRyYW5zVW5pdC5pZCkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjb25zdCBuZXdUdSA9ICg8QWJzdHJhY3RUcmFuc1VuaXQ+Zm9yZWlnblRyYW5zVW5pdCkuY2xvbmVXaXRoU291cmNlQXNUYXJnZXQoaXNEZWZhdWx0TGFuZywgY29weUNvbnRlbnQsIHRoaXMpO1xyXG4gICAgICAgIGNvbnN0IGJvZHlFbGVtZW50ID0gRE9NVXRpbGl0aWVzLmdldEZpcnN0RWxlbWVudEJ5VGFnTmFtZSh0aGlzLl9wYXJzZWREb2N1bWVudCwgJ2JvZHknKTtcclxuICAgICAgICBpZiAoIWJvZHlFbGVtZW50KSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihmb3JtYXQoJ0ZpbGUgXCIlc1wiIHNlZW1zIHRvIGJlIG5vIHhsaWZmIDEuMiBmaWxlIChzaG91bGQgY29udGFpbiBhIGJvZHkgZWxlbWVudCknLCB0aGlzLl9maWxlbmFtZSkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBsZXQgaW5zZXJ0ZWQgPSBmYWxzZTtcclxuICAgICAgICBsZXQgaXNBZnRlckVsZW1lbnRQYXJ0T2ZGaWxlID0gZmFsc2U7XHJcbiAgICAgICAgaWYgKCEhaW1wb3J0QWZ0ZXJFbGVtZW50KSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGluc2VydGlvblBvaW50ID0gdGhpcy50cmFuc1VuaXRXaXRoSWQoaW1wb3J0QWZ0ZXJFbGVtZW50LmlkKTtcclxuICAgICAgICAgICAgaWYgKCEhaW5zZXJ0aW9uUG9pbnQpIHtcclxuICAgICAgICAgICAgICAgIGlzQWZ0ZXJFbGVtZW50UGFydE9mRmlsZSA9IHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGltcG9ydEFmdGVyRWxlbWVudCA9PT0gdW5kZWZpbmVkIHx8IChpbXBvcnRBZnRlckVsZW1lbnQgJiYgIWlzQWZ0ZXJFbGVtZW50UGFydE9mRmlsZSkpIHtcclxuICAgICAgICAgICAgYm9keUVsZW1lbnQuYXBwZW5kQ2hpbGQobmV3VHUuYXNYbWxFbGVtZW50KCkpO1xyXG4gICAgICAgICAgICBpbnNlcnRlZCA9IHRydWU7XHJcbiAgICAgICAgfSBlbHNlIGlmIChpbXBvcnRBZnRlckVsZW1lbnQgPT09IG51bGwpIHtcclxuICAgICAgICAgICAgY29uc3QgZmlyc3RVbml0RWxlbWVudCA9IERPTVV0aWxpdGllcy5nZXRGaXJzdEVsZW1lbnRCeVRhZ05hbWUodGhpcy5fcGFyc2VkRG9jdW1lbnQsICd0cmFucy11bml0Jyk7XHJcbiAgICAgICAgICAgIGlmIChmaXJzdFVuaXRFbGVtZW50KSB7XHJcbiAgICAgICAgICAgICAgICBET01VdGlsaXRpZXMuaW5zZXJ0QmVmb3JlKG5ld1R1LmFzWG1sRWxlbWVudCgpLCBmaXJzdFVuaXRFbGVtZW50KTtcclxuICAgICAgICAgICAgICAgIGluc2VydGVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIC8vIG5vIHRyYW5zLXVuaXQsIGVtcHR5IGZpbGUsIHNvIGFkZCB0byBib2R5XHJcbiAgICAgICAgICAgICAgICBib2R5RWxlbWVudC5hcHBlbmRDaGlsZChuZXdUdS5hc1htbEVsZW1lbnQoKSk7XHJcbiAgICAgICAgICAgICAgICBpbnNlcnRlZCA9IHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBjb25zdCByZWZVbml0RWxlbWVudCA9IERPTVV0aWxpdGllcy5nZXRFbGVtZW50QnlUYWdOYW1lQW5kSWQodGhpcy5fcGFyc2VkRG9jdW1lbnQsICd0cmFucy11bml0JywgaW1wb3J0QWZ0ZXJFbGVtZW50LmlkKTtcclxuICAgICAgICAgICAgaWYgKHJlZlVuaXRFbGVtZW50KSB7XHJcbiAgICAgICAgICAgICAgICBET01VdGlsaXRpZXMuaW5zZXJ0QWZ0ZXIobmV3VHUuYXNYbWxFbGVtZW50KCksIHJlZlVuaXRFbGVtZW50KTtcclxuICAgICAgICAgICAgICAgIGluc2VydGVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoaW5zZXJ0ZWQpIHtcclxuICAgICAgICAgICAgdGhpcy5sYXp5SW5pdGlhbGl6ZVRyYW5zVW5pdHMoKTtcclxuICAgICAgICAgICAgdGhpcy50cmFuc1VuaXRzLnB1c2gobmV3VHUpO1xyXG4gICAgICAgICAgICB0aGlzLmNvdW50TnVtYmVycygpO1xyXG4gICAgICAgICAgICByZXR1cm4gbmV3VHU7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlIGEgbmV3IHRyYW5zbGF0aW9uIGZpbGUgZm9yIHRoaXMgZmlsZSBmb3IgYSBnaXZlbiBsYW5ndWFnZS5cclxuICAgICAqIE5vcm1hbGx5LCB0aGlzIGlzIGp1c3QgYSBjb3B5IG9mIHRoZSBvcmlnaW5hbCBvbmUuXHJcbiAgICAgKiBCdXQgZm9yIFhNQiB0aGUgdHJhbnNsYXRpb24gZmlsZSBoYXMgZm9ybWF0ICdYVEInLlxyXG4gICAgICogQHBhcmFtIGxhbmcgTGFuZ3VhZ2UgY29kZVxyXG4gICAgICogQHBhcmFtIGZpbGVuYW1lIGV4cGVjdGVkIGZpbGVuYW1lIHRvIHN0b3JlIGZpbGVcclxuICAgICAqIEBwYXJhbSBpc0RlZmF1bHRMYW5nIEZsYWcsIHdldGhlciBmaWxlIGNvbnRhaW5zIHRoZSBkZWZhdWx0IGxhbmd1YWdlLlxyXG4gICAgICogVGhlbiBzb3VyY2UgYW5kIHRhcmdldCBhcmUganVzdCBlcXVhbC5cclxuICAgICAqIFRoZSBjb250ZW50IHdpbGwgYmUgY29waWVkLlxyXG4gICAgICogU3RhdGUgd2lsbCBiZSBmaW5hbC5cclxuICAgICAqIEBwYXJhbSBjb3B5Q29udGVudCBGbGFnLCB3ZXRoZXIgdG8gY29weSBjb250ZW50IG9yIGxlYXZlIGl0IGVtcHR5LlxyXG4gICAgICogV2JlbiB0cnVlLCBjb250ZW50IHdpbGwgYmUgY29waWVkIGZyb20gc291cmNlLlxyXG4gICAgICogV2hlbiBmYWxzZSwgY29udGVudCB3aWxsIGJlIGxlZnQgZW1wdHkgKGlmIGl0IGlzIG5vdCB0aGUgZGVmYXVsdCBsYW5ndWFnZSkuXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBjcmVhdGVUcmFuc2xhdGlvbkZpbGVGb3JMYW5nKGxhbmc6IHN0cmluZywgZmlsZW5hbWU6IHN0cmluZywgaXNEZWZhdWx0TGFuZzogYm9vbGVhbiwgY29weUNvbnRlbnQ6IGJvb2xlYW4sIG9wdGlvbmFsTWFzdGVyPzogeyB4bWxDb250ZW50OiBzdHJpbmcsIHBhdGg6IHN0cmluZywgZW5jb2Rpbmc6IHN0cmluZyB9KVxyXG4gICAgICAgIDogSVRyYW5zbGF0aW9uTWVzc2FnZXNGaWxlIHtcclxuXHJcbiAgICAgICAgY29uc3QgdHJhbnNsYXRpb25GaWxlID0gbmV3IFhsaWZmRmlsZSh0aGlzLmVkaXRlZENvbnRlbnQoKSwgZmlsZW5hbWUsIHRoaXMuZW5jb2RpbmcoKSwgb3B0aW9uYWxNYXN0ZXIpO1xyXG4gICAgICAgIHRyYW5zbGF0aW9uRmlsZS5zZXROZXdUcmFuc1VuaXRUYXJnZXRQcmFlZml4KHRoaXMudGFyZ2V0UHJhZWZpeCk7XHJcbiAgICAgICAgdHJhbnNsYXRpb25GaWxlLnNldE5ld1RyYW5zVW5pdFRhcmdldFN1ZmZpeCh0aGlzLnRhcmdldFN1ZmZpeCk7XHJcbiAgICAgICAgdHJhbnNsYXRpb25GaWxlLnNldFRhcmdldExhbmd1YWdlKGxhbmcpO1xyXG4gICAgICAgIHRyYW5zbGF0aW9uRmlsZS5mb3JFYWNoVHJhbnNVbml0KCh0cmFuc1VuaXQ6IElUcmFuc1VuaXQpID0+IHtcclxuICAgICAgICAgICAgKDxBYnN0cmFjdFRyYW5zVW5pdD50cmFuc1VuaXQpLnVzZVNvdXJjZUFzVGFyZ2V0KGlzRGVmYXVsdExhbmcsIGNvcHlDb250ZW50KTtcclxuICAgICAgICB9KTtcclxuXHJcbiAgICAgICAgaWYgKG9wdGlvbmFsTWFzdGVyICYmIHRyYW5zbGF0aW9uRmlsZS5vcHRpb25hbE1hc3RlclRyYW5zVW5pdHMgJiYgdHJhbnNsYXRpb25GaWxlLm9wdGlvbmFsTWFzdGVyVHJhbnNVbml0cy5sZW5ndGggPiAwKSB7XHJcbiAgICAgICAgICAgIC8vIElmIG9wdGlvbmFsIG1hc3RlciBpcyBzcGVjaWZpZWQgd2Ugd2lsbCBpdGVyYXRlIHRoZSBtYXN0ZXIgdHJhbnN1bml0cyBhbmQgcmVtb3ZlIGZyb20gdHJhbnNsYXRpb24gZmlsZSBpZiB0aGV5IGFscmVhZHkgZXhpc3QgaW4gdGhlIG1hc3RlclxyXG4gICAgICAgICAgICB0cmFuc2xhdGlvbkZpbGUub3B0aW9uYWxNYXN0ZXJUcmFuc1VuaXRzLmZvckVhY2godW5pdCA9PiB7XHJcbiAgICAgICAgICAgICAgICBjb25zdCB0cmFuVW5pdCA9IHRyYW5zbGF0aW9uRmlsZS50cmFuc1VuaXRXaXRoSWQodW5pdC5pZCk7XHJcbiAgICAgICAgICAgICAgICBpZiAodHJhblVuaXQpIHtcclxuICAgICAgICAgICAgICAgICAgICB0cmFuc2xhdGlvbkZpbGUucmVtb3ZlVHJhbnNVbml0V2l0aElkKHRyYW5Vbml0LmlkKTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gdHJhbnNsYXRpb25GaWxlO1xyXG4gICAgfVxyXG59XHJcbiJdfQ==