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
        this.initializeFromContent(xmlString, path, encoding);
    }
    initializeFromContent(xmlString, path, encoding) {
        this.parseContent(xmlString, path, encoding);
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
        let transUnitsInOptionalMasterFile;
        const transUnitsInFile = this._parsedDocument.getElementsByTagName('trans-unit');
        if (this._parsedOptionalMasterDocument) {
            transUnitsInOptionalMasterFile = this._parsedOptionalMasterDocument.getElementsByTagName('trans-unit');
        }
        for (let i = 0; i < transUnitsInFile.length; i++) {
            const transunit = transUnitsInFile.item(i);
            const id = transunit.getAttribute('id');
            if (!id) {
                this._warnings.push(format('oops, trans-unit without "id" found in master, please check file %s', this._filename));
            }
            if (transUnitsInOptionalMasterFile && transUnitsInOptionalMasterFile.length > 0) {
                const transunitOptionalMaster = transUnitsInOptionalMasterFile.item(i);
                const idOptionalMaster = transunitOptionalMaster.getAttribute('id');
                if (!idOptionalMaster) {
                    this.transUnits.push(new XliffTransUnit(transunit, id, this));
                }
            }
            else {
                this.transUnits.push(new XliffTransUnit(transunit, id, this));
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
        return translationFile;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieGxpZmYtZmlsZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3Byb2plY3RzL25neC1pMThuc3VwcG9ydC1saWIvc3JjL2ltcGwveGxpZmYtZmlsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sTUFBTSxDQUFDO0FBRzlCLE9BQU8sRUFBRSxjQUFjLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUNwRSxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDL0MsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLG9CQUFvQixDQUFDO0FBQ3BELE9BQU8sRUFBRSwrQkFBK0IsRUFBRSxNQUFNLHNDQUFzQyxDQUFDO0FBRXZGOzs7O0dBSUc7QUFFSCxNQUFNLE9BQU8sU0FBVSxTQUFRLCtCQUErQjtJQUUxRDs7Ozs7OztPQU9HO0lBQ0gsWUFBWSxTQUFpQixFQUFFLElBQVksRUFBRSxRQUFnQixFQUFFLGNBQXVFO1FBQ2xJLEtBQUssRUFBRSxDQUFDO1FBQ1IsSUFBSSxDQUFDLFNBQVMsR0FBRyxFQUFFLENBQUM7UUFDcEIsSUFBSSxDQUFDLGdDQUFnQyxHQUFHLENBQUMsQ0FBQztRQUMxQyxJQUFJLENBQUMscUJBQXFCLENBQUMsU0FBUyxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQztJQUMxRCxDQUFDO0lBRU8scUJBQXFCLENBQUMsU0FBaUIsRUFBRSxJQUFZLEVBQUUsUUFBZ0I7UUFDM0UsSUFBSSxDQUFDLFlBQVksQ0FBQyxTQUFTLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQzdDLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsb0JBQW9CLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDckUsSUFBSSxTQUFTLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUN4QixNQUFNLElBQUksS0FBSyxDQUFDLE1B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QyxTQUFVLENBQUMsaUJBQWlCLENBQUMsYUFBYSxFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBQ2pGLENBQUMsQ0FBQyxDQUFDO1FBQ0gsT0FBTyxlQUFlLENBQUM7SUFDM0IsQ0FBQztDQUNKIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgZm9ybWF0IH0gZnJvbSAndXRpbCc7XHJcbmltcG9ydCB7IElUcmFuc2xhdGlvbk1lc3NhZ2VzRmlsZSB9IGZyb20gJy4uL2FwaS9pLXRyYW5zbGF0aW9uLW1lc3NhZ2VzLWZpbGUnO1xyXG5pbXBvcnQgeyBJVHJhbnNVbml0IH0gZnJvbSAnLi4vYXBpL2ktdHJhbnMtdW5pdCc7XHJcbmltcG9ydCB7IEZPUk1BVF9YTElGRjEyLCBGSUxFVFlQRV9YTElGRjEyIH0gZnJvbSAnLi4vYXBpL2NvbnN0YW50cyc7XHJcbmltcG9ydCB7IERPTVV0aWxpdGllcyB9IGZyb20gJy4vZG9tLXV0aWxpdGllcyc7XHJcbmltcG9ydCB7IFhsaWZmVHJhbnNVbml0IH0gZnJvbSAnLi94bGlmZi10cmFucy11bml0JztcclxuaW1wb3J0IHsgQWJzdHJhY3RUcmFuc2xhdGlvbk1lc3NhZ2VzRmlsZSB9IGZyb20gJy4vYWJzdHJhY3QtdHJhbnNsYXRpb24tbWVzc2FnZXMtZmlsZSc7XHJcbmltcG9ydCB7IEFic3RyYWN0VHJhbnNVbml0IH0gZnJvbSAnLi9hYnN0cmFjdC10cmFucy11bml0JztcclxuLyoqXHJcbiAqIENyZWF0ZWQgYnkgbWFydGluIG9uIDIzLjAyLjIwMTcuXHJcbiAqIEFiIHhsaWZmIGZpbGUgcmVhZCBmcm9tIGEgc291cmNlIGZpbGUuXHJcbiAqIERlZmluZXMgc29tZSByZWxldmFudCBnZXQgYW5kIHNldCBtZXRob2QgZm9yIHJlYWRpbmcgYW5kIG1vZGlmeWluZyBzdWNoIGEgZmlsZS5cclxuICovXHJcblxyXG5leHBvcnQgY2xhc3MgWGxpZmZGaWxlIGV4dGVuZHMgQWJzdHJhY3RUcmFuc2xhdGlvbk1lc3NhZ2VzRmlsZSBpbXBsZW1lbnRzIElUcmFuc2xhdGlvbk1lc3NhZ2VzRmlsZSB7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGUgYW4geGxmLUZpbGUgZnJvbSBzb3VyY2UuXHJcbiAgICAgKiBAcGFyYW0geG1sU3RyaW5nIHNvdXJjZSByZWFkIGZyb20gZmlsZS5cclxuICAgICAqIEBwYXJhbSBwYXRoIFBhdGggdG8gZmlsZVxyXG4gICAgICogQHBhcmFtIGVuY29kaW5nIG9wdGlvbmFsIGVuY29kaW5nIG9mIHRoZSB4bWwuXHJcbiAgICAgKiBUaGlzIGlzIHJlYWQgZnJvbSB0aGUgZmlsZSwgYnV0IGlmIHlvdSBrbm93IGl0IGJlZm9yZSwgeW91IGNhbiBhdm9pZCByZWFkaW5nIHRoZSBmaWxlIHR3aWNlLlxyXG4gICAgICogQHJldHVybiBYbGlmZkZpbGVcclxuICAgICAqL1xyXG4gICAgY29uc3RydWN0b3IoeG1sU3RyaW5nOiBzdHJpbmcsIHBhdGg6IHN0cmluZywgZW5jb2Rpbmc6IHN0cmluZywgb3B0aW9uYWxNYXN0ZXI/OiB7IHhtbENvbnRlbnQ6IHN0cmluZywgcGF0aDogc3RyaW5nLCBlbmNvZGluZzogc3RyaW5nIH0pIHtcclxuICAgICAgICBzdXBlcigpO1xyXG4gICAgICAgIHRoaXMuX3dhcm5pbmdzID0gW107XHJcbiAgICAgICAgdGhpcy5fbnVtYmVyT2ZUcmFuc1VuaXRzV2l0aE1pc3NpbmdJZCA9IDA7XHJcbiAgICAgICAgdGhpcy5pbml0aWFsaXplRnJvbUNvbnRlbnQoeG1sU3RyaW5nLCBwYXRoLCBlbmNvZGluZyk7XHJcbiAgICB9XHJcblxyXG4gICAgcHJpdmF0ZSBpbml0aWFsaXplRnJvbUNvbnRlbnQoeG1sU3RyaW5nOiBzdHJpbmcsIHBhdGg6IHN0cmluZywgZW5jb2Rpbmc6IHN0cmluZyk6IFhsaWZmRmlsZSB7XHJcbiAgICAgICAgdGhpcy5wYXJzZUNvbnRlbnQoeG1sU3RyaW5nLCBwYXRoLCBlbmNvZGluZyk7XHJcbiAgICAgICAgY29uc3QgeGxpZmZMaXN0ID0gdGhpcy5fcGFyc2VkRG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ3hsaWZmJyk7XHJcbiAgICAgICAgaWYgKHhsaWZmTGlzdC5sZW5ndGggIT09IDEpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGZvcm1hdCgnRmlsZSBcIiVzXCIgc2VlbXMgdG8gYmUgbm8geGxpZmYgZmlsZSAoc2hvdWxkIGNvbnRhaW4gYW4geGxpZmYgZWxlbWVudCknLCBwYXRoKSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgY29uc3QgdmVyc2lvbiA9IHhsaWZmTGlzdC5pdGVtKDApLmdldEF0dHJpYnV0ZSgndmVyc2lvbicpO1xyXG4gICAgICAgICAgICBjb25zdCBleHBlY3RlZFZlcnNpb24gPSAnMS4yJztcclxuICAgICAgICAgICAgaWYgKHZlcnNpb24gIT09IGV4cGVjdGVkVmVyc2lvbikge1xyXG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGZvcm1hdCgnRmlsZSBcIiVzXCIgc2VlbXMgdG8gYmUgbm8geGxpZmYgMS4yIGZpbGUsIHZlcnNpb24gc2hvdWxkIGJlICVzLCBmb3VuZCAlcycsXHJcbiAgICAgICAgICAgICAgICAgICAgcGF0aCwgZXhwZWN0ZWRWZXJzaW9uLCB2ZXJzaW9uKSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBGaWxlIGZvcm1hdCBhcyBpdCBpcyB1c2VkIGluIGNvbmZpZyBmaWxlcy5cclxuICAgICAqIEN1cnJlbnRseSAneGxmJywgJ3htYicsICd4bWIyJ1xyXG4gICAgICogUmV0dXJucyBvbmUgb2YgdGhlIGNvbnN0YW50cyBGT1JNQVRfLi5cclxuICAgICAqL1xyXG4gICAgcHVibGljIGkxOG5Gb3JtYXQoKTogc3RyaW5nIHtcclxuICAgICAgICByZXR1cm4gRk9STUFUX1hMSUZGMTI7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBGaWxlIHR5cGUuXHJcbiAgICAgKiBIZXJlICdYTElGRiAxLjInXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBmaWxlVHlwZSgpOiBzdHJpbmcge1xyXG4gICAgICAgIHJldHVybiBGSUxFVFlQRV9YTElGRjEyO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogcmV0dXJuIHRhZyBuYW1lcyBvZiBhbGwgZWxlbWVudHMgdGhhdCBoYXZlIG1peGVkIGNvbnRlbnQuXHJcbiAgICAgKiBUaGVzZSBlbGVtZW50cyB3aWxsIG5vdCBiZSBiZWF1dGlmaWVkLlxyXG4gICAgICogVHlwaWNhbCBjYW5kaWRhdGVzIGFyZSBzb3VyY2UgYW5kIHRhcmdldC5cclxuICAgICAqL1xyXG4gICAgcHJvdGVjdGVkIGVsZW1lbnRzV2l0aE1peGVkQ29udGVudCgpOiBzdHJpbmdbXSB7XHJcbiAgICAgICAgcmV0dXJuIFsnc291cmNlJywgJ3RhcmdldCcsICd0b29sJywgJ3NlZy1zb3VyY2UnLCAnZycsICdwaCcsICdicHQnLCAnZXB0JywgJ2l0JywgJ3N1YicsICdtcmsnXTtcclxuICAgIH1cclxuXHJcbiAgICBwcm90ZWN0ZWQgaW5pdGlhbGl6ZVRyYW5zVW5pdHMoKSB7XHJcbiAgICAgICAgdGhpcy50cmFuc1VuaXRzID0gW107XHJcbiAgICAgICAgbGV0IHRyYW5zVW5pdHNJbk9wdGlvbmFsTWFzdGVyRmlsZTogSFRNTENvbGxlY3Rpb25PZjxFbGVtZW50PjtcclxuICAgICAgICBjb25zdCB0cmFuc1VuaXRzSW5GaWxlID0gdGhpcy5fcGFyc2VkRG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ3RyYW5zLXVuaXQnKTtcclxuICAgICAgICBpZiAodGhpcy5fcGFyc2VkT3B0aW9uYWxNYXN0ZXJEb2N1bWVudCkge1xyXG4gICAgICAgICAgICB0cmFuc1VuaXRzSW5PcHRpb25hbE1hc3RlckZpbGUgPSB0aGlzLl9wYXJzZWRPcHRpb25hbE1hc3RlckRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCd0cmFucy11bml0Jyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdHJhbnNVbml0c0luRmlsZS5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBjb25zdCB0cmFuc3VuaXQgPSB0cmFuc1VuaXRzSW5GaWxlLml0ZW0oaSk7XHJcbiAgICAgICAgICAgIGNvbnN0IGlkID0gdHJhbnN1bml0LmdldEF0dHJpYnV0ZSgnaWQnKTtcclxuICAgICAgICAgICAgaWYgKCFpZCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fd2FybmluZ3MucHVzaChmb3JtYXQoJ29vcHMsIHRyYW5zLXVuaXQgd2l0aG91dCBcImlkXCIgZm91bmQgaW4gbWFzdGVyLCBwbGVhc2UgY2hlY2sgZmlsZSAlcycsIHRoaXMuX2ZpbGVuYW1lKSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKHRyYW5zVW5pdHNJbk9wdGlvbmFsTWFzdGVyRmlsZSAmJiB0cmFuc1VuaXRzSW5PcHRpb25hbE1hc3RlckZpbGUubGVuZ3RoID4gMCkge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgdHJhbnN1bml0T3B0aW9uYWxNYXN0ZXIgPSB0cmFuc1VuaXRzSW5PcHRpb25hbE1hc3RlckZpbGUuaXRlbShpKTtcclxuICAgICAgICAgICAgICAgIGNvbnN0IGlkT3B0aW9uYWxNYXN0ZXIgPSB0cmFuc3VuaXRPcHRpb25hbE1hc3Rlci5nZXRBdHRyaWJ1dGUoJ2lkJyk7XHJcbiAgICAgICAgICAgICAgICBpZiAoIWlkT3B0aW9uYWxNYXN0ZXIpIHtcclxuICAgICAgICAgICAgICAgICAgICB0aGlzLnRyYW5zVW5pdHMucHVzaChuZXcgWGxpZmZUcmFuc1VuaXQodHJhbnN1bml0LCBpZCwgdGhpcykpO1xyXG4gICAgICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICAgICAgdGhpcy50cmFuc1VuaXRzLnB1c2gobmV3IFhsaWZmVHJhbnNVbml0KHRyYW5zdW5pdCwgaWQsIHRoaXMpKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEdldCBzb3VyY2UgbGFuZ3VhZ2UuXHJcbiAgICAgKiBAcmV0dXJuIHNvdXJjZSBsYW5ndWFnZS5cclxuICAgICAqL1xyXG4gICAgcHVibGljIHNvdXJjZUxhbmd1YWdlKCk6IHN0cmluZyB7XHJcbiAgICAgICAgY29uc3QgZmlsZUVsZW0gPSBET01VdGlsaXRpZXMuZ2V0Rmlyc3RFbGVtZW50QnlUYWdOYW1lKHRoaXMuX3BhcnNlZERvY3VtZW50LCAnZmlsZScpO1xyXG4gICAgICAgIGlmIChmaWxlRWxlbSkge1xyXG4gICAgICAgICAgICByZXR1cm4gZmlsZUVsZW0uZ2V0QXR0cmlidXRlKCdzb3VyY2UtbGFuZ3VhZ2UnKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBFZGl0IHRoZSBzb3VyY2UgbGFuZ3VhZ2UuXHJcbiAgICAgKiBAcGFyYW0gbGFuZ3VhZ2UgbGFuZ3VhZ2VcclxuICAgICAqL1xyXG4gICAgcHVibGljIHNldFNvdXJjZUxhbmd1YWdlKGxhbmd1YWdlOiBzdHJpbmcpIHtcclxuICAgICAgICBjb25zdCBmaWxlRWxlbSA9IERPTVV0aWxpdGllcy5nZXRGaXJzdEVsZW1lbnRCeVRhZ05hbWUodGhpcy5fcGFyc2VkRG9jdW1lbnQsICdmaWxlJyk7XHJcbiAgICAgICAgaWYgKGZpbGVFbGVtKSB7XHJcbiAgICAgICAgICAgIGZpbGVFbGVtLnNldEF0dHJpYnV0ZSgnc291cmNlLWxhbmd1YWdlJywgbGFuZ3VhZ2UpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEdldCB0YXJnZXQgbGFuZ3VhZ2UuXHJcbiAgICAgKiBAcmV0dXJuIHRhcmdldCBsYW5ndWFnZS5cclxuICAgICAqL1xyXG4gICAgcHVibGljIHRhcmdldExhbmd1YWdlKCk6IHN0cmluZyB7XHJcbiAgICAgICAgY29uc3QgZmlsZUVsZW0gPSBET01VdGlsaXRpZXMuZ2V0Rmlyc3RFbGVtZW50QnlUYWdOYW1lKHRoaXMuX3BhcnNlZERvY3VtZW50LCAnZmlsZScpO1xyXG4gICAgICAgIGlmIChmaWxlRWxlbSkge1xyXG4gICAgICAgICAgICByZXR1cm4gZmlsZUVsZW0uZ2V0QXR0cmlidXRlKCd0YXJnZXQtbGFuZ3VhZ2UnKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBFZGl0IHRoZSB0YXJnZXQgbGFuZ3VhZ2UuXHJcbiAgICAgKiBAcGFyYW0gbGFuZ3VhZ2UgbGFuZ3VhZ2VcclxuICAgICAqL1xyXG4gICAgcHVibGljIHNldFRhcmdldExhbmd1YWdlKGxhbmd1YWdlOiBzdHJpbmcpIHtcclxuICAgICAgICBjb25zdCBmaWxlRWxlbSA9IERPTVV0aWxpdGllcy5nZXRGaXJzdEVsZW1lbnRCeVRhZ05hbWUodGhpcy5fcGFyc2VkRG9jdW1lbnQsICdmaWxlJyk7XHJcbiAgICAgICAgaWYgKGZpbGVFbGVtKSB7XHJcbiAgICAgICAgICAgIGZpbGVFbGVtLnNldEF0dHJpYnV0ZSgndGFyZ2V0LWxhbmd1YWdlJywgbGFuZ3VhZ2UpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEFkZCBhIG5ldyB0cmFucy11bml0IHRvIHRoaXMgZmlsZS5cclxuICAgICAqIFRoZSB0cmFucyB1bml0IHN0ZW1zIGZyb20gYW5vdGhlciBmaWxlLlxyXG4gICAgICogSXQgY29waWVzIHRoZSBzb3VyY2UgY29udGVudCBvZiB0aGUgdHUgdG8gdGhlIHRhcmdldCBjb250ZW50IHRvbyxcclxuICAgICAqIGRlcGVuZGluZyBvbiB0aGUgdmFsdWVzIG9mIGlzRGVmYXVsdExhbmcgYW5kIGNvcHlDb250ZW50LlxyXG4gICAgICogU28gdGhlIHNvdXJjZSBjYW4gYmUgdXNlZCBhcyBhIGR1bW15IHRyYW5zbGF0aW9uLlxyXG4gICAgICogKHVzZWQgYnkgeGxpZmZtZXJnZSlcclxuICAgICAqIEBwYXJhbSBmb3JlaWduVHJhbnNVbml0IHRoZSB0cmFucyB1bml0IHRvIGJlIGltcG9ydGVkLlxyXG4gICAgICogQHBhcmFtIGlzRGVmYXVsdExhbmcgRmxhZywgd2V0aGVyIGZpbGUgY29udGFpbnMgdGhlIGRlZmF1bHQgbGFuZ3VhZ2UuXHJcbiAgICAgKiBUaGVuIHNvdXJjZSBhbmQgdGFyZ2V0IGFyZSBqdXN0IGVxdWFsLlxyXG4gICAgICogVGhlIGNvbnRlbnQgd2lsbCBiZSBjb3BpZWQuXHJcbiAgICAgKiBTdGF0ZSB3aWxsIGJlIGZpbmFsLlxyXG4gICAgICogQHBhcmFtIGNvcHlDb250ZW50IEZsYWcsIHdldGhlciB0byBjb3B5IGNvbnRlbnQgb3IgbGVhdmUgaXQgZW1wdHkuXHJcbiAgICAgKiBXYmVuIHRydWUsIGNvbnRlbnQgd2lsbCBiZSBjb3BpZWQgZnJvbSBzb3VyY2UuXHJcbiAgICAgKiBXaGVuIGZhbHNlLCBjb250ZW50IHdpbGwgYmUgbGVmdCBlbXB0eSAoaWYgaXQgaXMgbm90IHRoZSBkZWZhdWx0IGxhbmd1YWdlKS5cclxuICAgICAqIEBwYXJhbSBpbXBvcnRBZnRlckVsZW1lbnQgb3B0aW9uYWwgKHNpbmNlIDEuMTApIG90aGVyIHRyYW5zdW5pdCAocGFydCBvZiB0aGlzIGZpbGUpLCB0aGF0IHNob3VsZCBiZSB1c2VkIGFzIGFuY2VzdG9yLlxyXG4gICAgICogTmV3bHkgaW1wb3J0ZWQgdHJhbnMgdW5pdCBpcyB0aGVuIGluc2VydGVkIGRpcmVjdGx5IGFmdGVyIHRoaXMgZWxlbWVudC5cclxuICAgICAqIElmIG5vdCBzZXQgb3Igbm90IHBhcnQgb2YgdGhpcyBmaWxlLCBuZXcgdW5pdCB3aWxsIGJlIGltcG9ydGVkIGF0IHRoZSBlbmQuXHJcbiAgICAgKiBJZiBleHBsaWNpdHkgc2V0IHRvIG51bGwsIG5ldyB1bml0IHdpbGwgYmUgaW1wb3J0ZWQgYXQgdGhlIHN0YXJ0LlxyXG4gICAgICogQHJldHVybiB0aGUgbmV3bHkgaW1wb3J0ZWQgdHJhbnMgdW5pdCAoc2luY2UgdmVyc2lvbiAxLjcuMClcclxuICAgICAqIEB0aHJvd3MgYW4gZXJyb3IgaWYgdHJhbnMtdW5pdCB3aXRoIHNhbWUgaWQgYWxyZWFkeSBpcyBpbiB0aGUgZmlsZS5cclxuICAgICAqL1xyXG4gICAgaW1wb3J0TmV3VHJhbnNVbml0KGZvcmVpZ25UcmFuc1VuaXQ6IElUcmFuc1VuaXQsIGlzRGVmYXVsdExhbmc6IGJvb2xlYW4sIGNvcHlDb250ZW50OiBib29sZWFuLCBpbXBvcnRBZnRlckVsZW1lbnQ/OiBJVHJhbnNVbml0KVxyXG4gICAgICAgIDogSVRyYW5zVW5pdCB7XHJcbiAgICAgICAgaWYgKHRoaXMudHJhbnNVbml0V2l0aElkKGZvcmVpZ25UcmFuc1VuaXQuaWQpKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihmb3JtYXQoJ3R1IHdpdGggaWQgJXMgYWxyZWFkeSBleGlzdHMgaW4gZmlsZSwgY2Fubm90IGltcG9ydCBpdCcsIGZvcmVpZ25UcmFuc1VuaXQuaWQpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgY29uc3QgbmV3VHUgPSAoPEFic3RyYWN0VHJhbnNVbml0PmZvcmVpZ25UcmFuc1VuaXQpLmNsb25lV2l0aFNvdXJjZUFzVGFyZ2V0KGlzRGVmYXVsdExhbmcsIGNvcHlDb250ZW50LCB0aGlzKTtcclxuICAgICAgICBjb25zdCBib2R5RWxlbWVudCA9IERPTVV0aWxpdGllcy5nZXRGaXJzdEVsZW1lbnRCeVRhZ05hbWUodGhpcy5fcGFyc2VkRG9jdW1lbnQsICdib2R5Jyk7XHJcbiAgICAgICAgaWYgKCFib2R5RWxlbWVudCkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoZm9ybWF0KCdGaWxlIFwiJXNcIiBzZWVtcyB0byBiZSBubyB4bGlmZiAxLjIgZmlsZSAoc2hvdWxkIGNvbnRhaW4gYSBib2R5IGVsZW1lbnQpJywgdGhpcy5fZmlsZW5hbWUpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgbGV0IGluc2VydGVkID0gZmFsc2U7XHJcbiAgICAgICAgbGV0IGlzQWZ0ZXJFbGVtZW50UGFydE9mRmlsZSA9IGZhbHNlO1xyXG4gICAgICAgIGlmICghIWltcG9ydEFmdGVyRWxlbWVudCkge1xyXG4gICAgICAgICAgICBjb25zdCBpbnNlcnRpb25Qb2ludCA9IHRoaXMudHJhbnNVbml0V2l0aElkKGltcG9ydEFmdGVyRWxlbWVudC5pZCk7XHJcbiAgICAgICAgICAgIGlmICghIWluc2VydGlvblBvaW50KSB7XHJcbiAgICAgICAgICAgICAgICBpc0FmdGVyRWxlbWVudFBhcnRPZkZpbGUgPSB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChpbXBvcnRBZnRlckVsZW1lbnQgPT09IHVuZGVmaW5lZCB8fCAoaW1wb3J0QWZ0ZXJFbGVtZW50ICYmICFpc0FmdGVyRWxlbWVudFBhcnRPZkZpbGUpKSB7XHJcbiAgICAgICAgICAgIGJvZHlFbGVtZW50LmFwcGVuZENoaWxkKG5ld1R1LmFzWG1sRWxlbWVudCgpKTtcclxuICAgICAgICAgICAgaW5zZXJ0ZWQgPSB0cnVlO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoaW1wb3J0QWZ0ZXJFbGVtZW50ID09PSBudWxsKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGZpcnN0VW5pdEVsZW1lbnQgPSBET01VdGlsaXRpZXMuZ2V0Rmlyc3RFbGVtZW50QnlUYWdOYW1lKHRoaXMuX3BhcnNlZERvY3VtZW50LCAndHJhbnMtdW5pdCcpO1xyXG4gICAgICAgICAgICBpZiAoZmlyc3RVbml0RWxlbWVudCkge1xyXG4gICAgICAgICAgICAgICAgRE9NVXRpbGl0aWVzLmluc2VydEJlZm9yZShuZXdUdS5hc1htbEVsZW1lbnQoKSwgZmlyc3RVbml0RWxlbWVudCk7XHJcbiAgICAgICAgICAgICAgICBpbnNlcnRlZCA9IHRydWU7XHJcbiAgICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgICAgICAvLyBubyB0cmFucy11bml0LCBlbXB0eSBmaWxlLCBzbyBhZGQgdG8gYm9keVxyXG4gICAgICAgICAgICAgICAgYm9keUVsZW1lbnQuYXBwZW5kQ2hpbGQobmV3VHUuYXNYbWxFbGVtZW50KCkpO1xyXG4gICAgICAgICAgICAgICAgaW5zZXJ0ZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgY29uc3QgcmVmVW5pdEVsZW1lbnQgPSBET01VdGlsaXRpZXMuZ2V0RWxlbWVudEJ5VGFnTmFtZUFuZElkKHRoaXMuX3BhcnNlZERvY3VtZW50LCAndHJhbnMtdW5pdCcsIGltcG9ydEFmdGVyRWxlbWVudC5pZCk7XHJcbiAgICAgICAgICAgIGlmIChyZWZVbml0RWxlbWVudCkge1xyXG4gICAgICAgICAgICAgICAgRE9NVXRpbGl0aWVzLmluc2VydEFmdGVyKG5ld1R1LmFzWG1sRWxlbWVudCgpLCByZWZVbml0RWxlbWVudCk7XHJcbiAgICAgICAgICAgICAgICBpbnNlcnRlZCA9IHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGluc2VydGVkKSB7XHJcbiAgICAgICAgICAgIHRoaXMubGF6eUluaXRpYWxpemVUcmFuc1VuaXRzKCk7XHJcbiAgICAgICAgICAgIHRoaXMudHJhbnNVbml0cy5wdXNoKG5ld1R1KTtcclxuICAgICAgICAgICAgdGhpcy5jb3VudE51bWJlcnMoKTtcclxuICAgICAgICAgICAgcmV0dXJuIG5ld1R1O1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZSBhIG5ldyB0cmFuc2xhdGlvbiBmaWxlIGZvciB0aGlzIGZpbGUgZm9yIGEgZ2l2ZW4gbGFuZ3VhZ2UuXHJcbiAgICAgKiBOb3JtYWxseSwgdGhpcyBpcyBqdXN0IGEgY29weSBvZiB0aGUgb3JpZ2luYWwgb25lLlxyXG4gICAgICogQnV0IGZvciBYTUIgdGhlIHRyYW5zbGF0aW9uIGZpbGUgaGFzIGZvcm1hdCAnWFRCJy5cclxuICAgICAqIEBwYXJhbSBsYW5nIExhbmd1YWdlIGNvZGVcclxuICAgICAqIEBwYXJhbSBmaWxlbmFtZSBleHBlY3RlZCBmaWxlbmFtZSB0byBzdG9yZSBmaWxlXHJcbiAgICAgKiBAcGFyYW0gaXNEZWZhdWx0TGFuZyBGbGFnLCB3ZXRoZXIgZmlsZSBjb250YWlucyB0aGUgZGVmYXVsdCBsYW5ndWFnZS5cclxuICAgICAqIFRoZW4gc291cmNlIGFuZCB0YXJnZXQgYXJlIGp1c3QgZXF1YWwuXHJcbiAgICAgKiBUaGUgY29udGVudCB3aWxsIGJlIGNvcGllZC5cclxuICAgICAqIFN0YXRlIHdpbGwgYmUgZmluYWwuXHJcbiAgICAgKiBAcGFyYW0gY29weUNvbnRlbnQgRmxhZywgd2V0aGVyIHRvIGNvcHkgY29udGVudCBvciBsZWF2ZSBpdCBlbXB0eS5cclxuICAgICAqIFdiZW4gdHJ1ZSwgY29udGVudCB3aWxsIGJlIGNvcGllZCBmcm9tIHNvdXJjZS5cclxuICAgICAqIFdoZW4gZmFsc2UsIGNvbnRlbnQgd2lsbCBiZSBsZWZ0IGVtcHR5IChpZiBpdCBpcyBub3QgdGhlIGRlZmF1bHQgbGFuZ3VhZ2UpLlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgY3JlYXRlVHJhbnNsYXRpb25GaWxlRm9yTGFuZyhsYW5nOiBzdHJpbmcsIGZpbGVuYW1lOiBzdHJpbmcsIGlzRGVmYXVsdExhbmc6IGJvb2xlYW4sIGNvcHlDb250ZW50OiBib29sZWFuLCBvcHRpb25hbE1hc3Rlcj86IHt4bWxDb250ZW50OiBzdHJpbmcsIHBhdGg6IHN0cmluZywgZW5jb2Rpbmc6IHN0cmluZ30pXHJcbiAgICAgICAgOiBJVHJhbnNsYXRpb25NZXNzYWdlc0ZpbGUge1xyXG4gICAgICAgIFxyXG4gICAgICAgIGNvbnN0IHRyYW5zbGF0aW9uRmlsZSA9IG5ldyBYbGlmZkZpbGUodGhpcy5lZGl0ZWRDb250ZW50KCksIGZpbGVuYW1lLCB0aGlzLmVuY29kaW5nKCksIG9wdGlvbmFsTWFzdGVyKTtcclxuICAgICAgICB0cmFuc2xhdGlvbkZpbGUuc2V0TmV3VHJhbnNVbml0VGFyZ2V0UHJhZWZpeCh0aGlzLnRhcmdldFByYWVmaXgpO1xyXG4gICAgICAgIHRyYW5zbGF0aW9uRmlsZS5zZXROZXdUcmFuc1VuaXRUYXJnZXRTdWZmaXgodGhpcy50YXJnZXRTdWZmaXgpO1xyXG4gICAgICAgIHRyYW5zbGF0aW9uRmlsZS5zZXRUYXJnZXRMYW5ndWFnZShsYW5nKTtcclxuICAgICAgICB0cmFuc2xhdGlvbkZpbGUuZm9yRWFjaFRyYW5zVW5pdCgodHJhbnNVbml0OiBJVHJhbnNVbml0KSA9PiB7XHJcbiAgICAgICAgICAgICg8QWJzdHJhY3RUcmFuc1VuaXQ+dHJhbnNVbml0KS51c2VTb3VyY2VBc1RhcmdldChpc0RlZmF1bHRMYW5nLCBjb3B5Q29udGVudCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgICAgcmV0dXJuIHRyYW5zbGF0aW9uRmlsZTtcclxuICAgIH1cclxufVxyXG4iXX0=