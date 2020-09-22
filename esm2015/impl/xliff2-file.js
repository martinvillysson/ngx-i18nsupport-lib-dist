import { format } from 'util';
import { FORMAT_XLIFF20, FILETYPE_XLIFF20 } from '../api/constants';
import { DOMUtilities } from './dom-utilities';
import { Xliff2TransUnit } from './xliff2-trans-unit';
import { AbstractTranslationMessagesFile } from './abstract-translation-messages-file';
/**
 * Created by martin on 04.05.2017.
 * An XLIFF 2.0 file read from a source file.
 * Format definition is: http://docs.oasis-open.org/xliff/xliff-core/v2.0/os/xliff-core-v2.0-os.html
 *
 * Defines some relevant get and set method for reading and modifying such a file.
 */
export class Xliff2File extends AbstractTranslationMessagesFile {
    /**
     * Create an XLIFF 2.0-File from source.
     * @param xmlString source read from file.
     * @param path Path to file
     * @param encoding optional encoding of the xml.
     * This is read from the file, but if you know it before, you can avoid reading the file twice.
     * @return xliff file
     */
    constructor(xmlString, path, encoding) {
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
            const expectedVersion = '2.0';
            if (version !== expectedVersion) {
                throw new Error(format('File "%s" seems to be no xliff 2 file, version should be %s, found %s', path, expectedVersion, version));
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
        return FORMAT_XLIFF20;
    }
    /**
     * File type.
     * Here 'XLIFF 2.0'
     */
    fileType() {
        return FILETYPE_XLIFF20;
    }
    /**
     * return tag names of all elements that have mixed content.
     * These elements will not be beautified.
     * Typical candidates are source and target.
     */
    elementsWithMixedContent() {
        return ['skeleton', 'note', 'data', 'source', 'target', 'pc', 'mrk'];
    }
    initializeTransUnits() {
        this.transUnits = [];
        const transUnitsInFile = this._parsedDocument.getElementsByTagName('unit');
        for (let i = 0; i < transUnitsInFile.length; i++) {
            const transunit = transUnitsInFile.item(i);
            const id = transunit.getAttribute('id');
            if (!id) {
                this._warnings.push(format('oops, trans-unit without "id" found in master, please check file %s', this._filename));
            }
            this.transUnits.push(new Xliff2TransUnit(transunit, id, this));
        }
    }
    /**
     * Get source language.
     * @return source language.
     */
    sourceLanguage() {
        const xliffElem = DOMUtilities.getFirstElementByTagName(this._parsedDocument, 'xliff');
        if (xliffElem) {
            return xliffElem.getAttribute('srcLang');
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
        const xliffElem = DOMUtilities.getFirstElementByTagName(this._parsedDocument, 'xliff');
        if (xliffElem) {
            xliffElem.setAttribute('srcLang', language);
        }
    }
    /**
     * Get target language.
     * @return target language.
     */
    targetLanguage() {
        const xliffElem = DOMUtilities.getFirstElementByTagName(this._parsedDocument, 'xliff');
        if (xliffElem) {
            return xliffElem.getAttribute('trgLang');
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
        const xliffElem = DOMUtilities.getFirstElementByTagName(this._parsedDocument, 'xliff');
        if (xliffElem) {
            xliffElem.setAttribute('trgLang', language);
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
        const fileElement = DOMUtilities.getFirstElementByTagName(this._parsedDocument, 'file');
        if (!fileElement) {
            throw new Error(format('File "%s" seems to be no xliff 2.0 file (should contain a file element)', this._filename));
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
            fileElement.appendChild(newTu.asXmlElement());
            inserted = true;
        }
        else if (importAfterElement === null) {
            const firstUnitElement = DOMUtilities.getFirstElementByTagName(this._parsedDocument, 'unit');
            if (firstUnitElement) {
                DOMUtilities.insertBefore(newTu.asXmlElement(), firstUnitElement);
                inserted = true;
            }
            else {
                // no trans-unit, empty file, so add to first file element
                fileElement.appendChild(newTu.asXmlElement());
                inserted = true;
            }
        }
        else {
            const refUnitElement = DOMUtilities.getElementByTagNameAndId(this._parsedDocument, 'unit', importAfterElement.id);
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
        const translationFile = new Xliff2File(this.editedContent(), filename, this.encoding());
        translationFile.setNewTransUnitTargetPraefix(this.targetPraefix);
        translationFile.setNewTransUnitTargetSuffix(this.targetSuffix);
        translationFile.setTargetLanguage(lang);
        translationFile.forEachTransUnit((transUnit) => {
            transUnit.useSourceAsTarget(isDefaultLang, copyContent);
        });
        return translationFile;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieGxpZmYyLWZpbGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9wcm9qZWN0cy9uZ3gtaTE4bnN1cHBvcnQtbGliL3NyYy9pbXBsL3hsaWZmMi1maWxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBQyxNQUFNLEVBQUMsTUFBTSxNQUFNLENBQUM7QUFHNUIsT0FBTyxFQUFDLGNBQWMsRUFBRSxnQkFBZ0IsRUFBQyxNQUFNLGtCQUFrQixDQUFDO0FBQ2xFLE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSxpQkFBaUIsQ0FBQztBQUM3QyxPQUFPLEVBQUMsZUFBZSxFQUFDLE1BQU0scUJBQXFCLENBQUM7QUFDcEQsT0FBTyxFQUFDLCtCQUErQixFQUFDLE1BQU0sc0NBQXNDLENBQUM7QUFFckY7Ozs7OztHQU1HO0FBRUgsTUFBTSxPQUFPLFVBQVcsU0FBUSwrQkFBK0I7SUFFM0Q7Ozs7Ozs7T0FPRztJQUNILFlBQVksU0FBaUIsRUFBRSxJQUFZLEVBQUUsUUFBZ0I7UUFDekQsS0FBSyxFQUFFLENBQUM7UUFDUixJQUFJLENBQUMsU0FBUyxHQUFHLEVBQUUsQ0FBQztRQUNwQixJQUFJLENBQUMsZ0NBQWdDLEdBQUcsQ0FBQyxDQUFDO1FBQzFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxTQUFTLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQzFELENBQUM7SUFFTyxxQkFBcUIsQ0FBQyxTQUFpQixFQUFFLElBQVksRUFBRSxRQUFnQjtRQUMzRSxJQUFJLENBQUMsWUFBWSxDQUFDLFNBQVMsRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDN0MsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxvQkFBb0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNyRSxJQUFJLFNBQVMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1lBQ3hCLE1BQU0sSUFBSSxLQUFLLENBQUMsTUFBTSxDQUFD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Ozs7Ozs7Ozs7Ozs7T0FhRztJQUNJLDRCQUE0QixDQUFDLElBQVksRUFBRSxRQUFnQixFQUFFLGFBQXNCLEVBQUUsV0FBb0IsRUFBRSxjQUFxRTtRQUVuTCxNQUFNLGVBQWUsR0FBRyxJQUFJLFVBQVUsQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLEVBQUUsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFDO1FBQ3hGLGVBQWUsQ0FBQyw0QkFBNEIsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDakUsZUFBZSxDQUFDLDJCQUEyQixDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUMvRCxlQUFlLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDeEMsZUFBZSxDQUFDLGdCQUFnQixDQUFDLENBQUMsU0FBcUIsRUFBRSxFQUFFO1lBQ2xDLFNBQVUsQ0FBQyxpQkFBaUIsQ0FBQyxhQUFhLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFDbEYsQ0FBQyxDQUFDLENBQUM7UUFDSCxPQUFPLGVBQWUsQ0FBQztJQUMzQixDQUFDO0NBQ0oiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge2Zvcm1hdH0gZnJvbSAndXRpbCc7XHJcbmltcG9ydCB7SVRyYW5zbGF0aW9uTWVzc2FnZXNGaWxlfSBmcm9tICcuLi9hcGkvaS10cmFuc2xhdGlvbi1tZXNzYWdlcy1maWxlJztcclxuaW1wb3J0IHtJVHJhbnNVbml0fSBmcm9tICcuLi9hcGkvaS10cmFucy11bml0JztcclxuaW1wb3J0IHtGT1JNQVRfWExJRkYyMCwgRklMRVRZUEVfWExJRkYyMH0gZnJvbSAnLi4vYXBpL2NvbnN0YW50cyc7XHJcbmltcG9ydCB7RE9NVXRpbGl0aWVzfSBmcm9tICcuL2RvbS11dGlsaXRpZXMnO1xyXG5pbXBvcnQge1hsaWZmMlRyYW5zVW5pdH0gZnJvbSAnLi94bGlmZjItdHJhbnMtdW5pdCc7XHJcbmltcG9ydCB7QWJzdHJhY3RUcmFuc2xhdGlvbk1lc3NhZ2VzRmlsZX0gZnJvbSAnLi9hYnN0cmFjdC10cmFuc2xhdGlvbi1tZXNzYWdlcy1maWxlJztcclxuaW1wb3J0IHtBYnN0cmFjdFRyYW5zVW5pdH0gZnJvbSAnLi9hYnN0cmFjdC10cmFucy11bml0JztcclxuLyoqXHJcbiAqIENyZWF0ZWQgYnkgbWFydGluIG9uIDA0LjA1LjIwMTcuXHJcbiAqIEFuIFhMSUZGIDIuMCBmaWxlIHJlYWQgZnJvbSBhIHNvdXJjZSBmaWxlLlxyXG4gKiBGb3JtYXQgZGVmaW5pdGlvbiBpczogaHR0cDovL2RvY3Mub2FzaXMtb3Blbi5vcmcveGxpZmYveGxpZmYtY29yZS92Mi4wL29zL3hsaWZmLWNvcmUtdjIuMC1vcy5odG1sXHJcbiAqXHJcbiAqIERlZmluZXMgc29tZSByZWxldmFudCBnZXQgYW5kIHNldCBtZXRob2QgZm9yIHJlYWRpbmcgYW5kIG1vZGlmeWluZyBzdWNoIGEgZmlsZS5cclxuICovXHJcblxyXG5leHBvcnQgY2xhc3MgWGxpZmYyRmlsZSBleHRlbmRzIEFic3RyYWN0VHJhbnNsYXRpb25NZXNzYWdlc0ZpbGUgaW1wbGVtZW50cyBJVHJhbnNsYXRpb25NZXNzYWdlc0ZpbGUge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlIGFuIFhMSUZGIDIuMC1GaWxlIGZyb20gc291cmNlLlxyXG4gICAgICogQHBhcmFtIHhtbFN0cmluZyBzb3VyY2UgcmVhZCBmcm9tIGZpbGUuXHJcbiAgICAgKiBAcGFyYW0gcGF0aCBQYXRoIHRvIGZpbGVcclxuICAgICAqIEBwYXJhbSBlbmNvZGluZyBvcHRpb25hbCBlbmNvZGluZyBvZiB0aGUgeG1sLlxyXG4gICAgICogVGhpcyBpcyByZWFkIGZyb20gdGhlIGZpbGUsIGJ1dCBpZiB5b3Uga25vdyBpdCBiZWZvcmUsIHlvdSBjYW4gYXZvaWQgcmVhZGluZyB0aGUgZmlsZSB0d2ljZS5cclxuICAgICAqIEByZXR1cm4geGxpZmYgZmlsZVxyXG4gICAgICovXHJcbiAgICBjb25zdHJ1Y3Rvcih4bWxTdHJpbmc6IHN0cmluZywgcGF0aDogc3RyaW5nLCBlbmNvZGluZzogc3RyaW5nKSB7XHJcbiAgICAgICAgc3VwZXIoKTtcclxuICAgICAgICB0aGlzLl93YXJuaW5ncyA9IFtdO1xyXG4gICAgICAgIHRoaXMuX251bWJlck9mVHJhbnNVbml0c1dpdGhNaXNzaW5nSWQgPSAwO1xyXG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZUZyb21Db250ZW50KHhtbFN0cmluZywgcGF0aCwgZW5jb2RpbmcpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgaW5pdGlhbGl6ZUZyb21Db250ZW50KHhtbFN0cmluZzogc3RyaW5nLCBwYXRoOiBzdHJpbmcsIGVuY29kaW5nOiBzdHJpbmcpOiBYbGlmZjJGaWxlIHtcclxuICAgICAgICB0aGlzLnBhcnNlQ29udGVudCh4bWxTdHJpbmcsIHBhdGgsIGVuY29kaW5nKTtcclxuICAgICAgICBjb25zdCB4bGlmZkxpc3QgPSB0aGlzLl9wYXJzZWREb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgneGxpZmYnKTtcclxuICAgICAgICBpZiAoeGxpZmZMaXN0Lmxlbmd0aCAhPT0gMSkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoZm9ybWF0KCdGaWxlIFwiJXNcIiBzZWVtcyB0byBiZSBubyB4bGlmZiBmaWxlIChzaG91bGQgY29udGFpbiBhbiB4bGlmZiBlbGVtZW50KScsIHBhdGgpKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICBjb25zdCB2ZXJzaW9uID0geGxpZmZMaXN0Lml0ZW0oMCkuZ2V0QXR0cmlidXRlKCd2ZXJzaW9uJyk7XHJcbiAgICAgICAgICAgIGNvbnN0IGV4cGVjdGVkVmVyc2lvbiA9ICcyLjAnO1xyXG4gICAgICAgICAgICBpZiAodmVyc2lvbiAhPT0gZXhwZWN0ZWRWZXJzaW9uKSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoZm9ybWF0KCdGaWxlIFwiJXNcIiBzZWVtcyB0byBiZSBubyB4bGlmZiAyIGZpbGUsIHZlcnNpb24gc2hvdWxkIGJlICVzLCBmb3VuZCAlcycsXHJcbiAgICAgICAgICAgICAgICAgICAgcGF0aCwgZXhwZWN0ZWRWZXJzaW9uLCB2ZXJzaW9uKSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBGaWxlIGZvcm1hdCBhcyBpdCBpcyB1c2VkIGluIGNvbmZpZyBmaWxlcy5cclxuICAgICAqIEN1cnJlbnRseSAneGxmJywgJ3htYicsICd4bWIyJ1xyXG4gICAgICogUmV0dXJucyBvbmUgb2YgdGhlIGNvbnN0YW50cyBGT1JNQVRfLi5cclxuICAgICAqL1xyXG4gICAgcHVibGljIGkxOG5Gb3JtYXQoKTogc3RyaW5nIHtcclxuICAgICAgICByZXR1cm4gRk9STUFUX1hMSUZGMjA7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBGaWxlIHR5cGUuXHJcbiAgICAgKiBIZXJlICdYTElGRiAyLjAnXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBmaWxlVHlwZSgpOiBzdHJpbmcge1xyXG4gICAgICAgIHJldHVybiBGSUxFVFlQRV9YTElGRjIwO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogcmV0dXJuIHRhZyBuYW1lcyBvZiBhbGwgZWxlbWVudHMgdGhhdCBoYXZlIG1peGVkIGNvbnRlbnQuXHJcbiAgICAgKiBUaGVzZSBlbGVtZW50cyB3aWxsIG5vdCBiZSBiZWF1dGlmaWVkLlxyXG4gICAgICogVHlwaWNhbCBjYW5kaWRhdGVzIGFyZSBzb3VyY2UgYW5kIHRhcmdldC5cclxuICAgICAqL1xyXG4gICAgcHJvdGVjdGVkIGVsZW1lbnRzV2l0aE1peGVkQ29udGVudCgpOiBzdHJpbmdbXSB7XHJcbiAgICAgICAgcmV0dXJuIFsnc2tlbGV0b24nLCAnbm90ZScsICdkYXRhJywgJ3NvdXJjZScsICd0YXJnZXQnLCAncGMnLCAnbXJrJ107XHJcbiAgICB9XHJcblxyXG4gICAgcHJvdGVjdGVkIGluaXRpYWxpemVUcmFuc1VuaXRzKCkge1xyXG4gICAgICAgIHRoaXMudHJhbnNVbml0cyA9IFtdO1xyXG4gICAgICAgIGNvbnN0IHRyYW5zVW5pdHNJbkZpbGUgPSB0aGlzLl9wYXJzZWREb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgndW5pdCcpO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdHJhbnNVbml0c0luRmlsZS5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBjb25zdCB0cmFuc3VuaXQgPSB0cmFuc1VuaXRzSW5GaWxlLml0ZW0oaSk7XHJcbiAgICAgICAgICAgIGNvbnN0IGlkID0gdHJhbnN1bml0LmdldEF0dHJpYnV0ZSgnaWQnKTtcclxuICAgICAgICAgICAgaWYgKCFpZCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fd2FybmluZ3MucHVzaChmb3JtYXQoJ29vcHMsIHRyYW5zLXVuaXQgd2l0aG91dCBcImlkXCIgZm91bmQgaW4gbWFzdGVyLCBwbGVhc2UgY2hlY2sgZmlsZSAlcycsIHRoaXMuX2ZpbGVuYW1lKSk7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdGhpcy50cmFuc1VuaXRzLnB1c2gobmV3IFhsaWZmMlRyYW5zVW5pdCh0cmFuc3VuaXQsIGlkLCB0aGlzKSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogR2V0IHNvdXJjZSBsYW5ndWFnZS5cclxuICAgICAqIEByZXR1cm4gc291cmNlIGxhbmd1YWdlLlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgc291cmNlTGFuZ3VhZ2UoKTogc3RyaW5nIHtcclxuICAgICAgICBjb25zdCB4bGlmZkVsZW0gPSBET01VdGlsaXRpZXMuZ2V0Rmlyc3RFbGVtZW50QnlUYWdOYW1lKHRoaXMuX3BhcnNlZERvY3VtZW50LCAneGxpZmYnKTtcclxuICAgICAgICBpZiAoeGxpZmZFbGVtKSB7XHJcbiAgICAgICAgICAgIHJldHVybiB4bGlmZkVsZW0uZ2V0QXR0cmlidXRlKCdzcmNMYW5nJyk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgcmV0dXJuIG51bGw7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogRWRpdCB0aGUgc291cmNlIGxhbmd1YWdlLlxyXG4gICAgICogQHBhcmFtIGxhbmd1YWdlIGxhbmd1YWdlXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBzZXRTb3VyY2VMYW5ndWFnZShsYW5ndWFnZTogc3RyaW5nKSB7XHJcbiAgICAgICAgY29uc3QgeGxpZmZFbGVtID0gRE9NVXRpbGl0aWVzLmdldEZpcnN0RWxlbWVudEJ5VGFnTmFtZSh0aGlzLl9wYXJzZWREb2N1bWVudCwgJ3hsaWZmJyk7XHJcbiAgICAgICAgaWYgKHhsaWZmRWxlbSkge1xyXG4gICAgICAgICAgICB4bGlmZkVsZW0uc2V0QXR0cmlidXRlKCdzcmNMYW5nJywgbGFuZ3VhZ2UpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEdldCB0YXJnZXQgbGFuZ3VhZ2UuXHJcbiAgICAgKiBAcmV0dXJuIHRhcmdldCBsYW5ndWFnZS5cclxuICAgICAqL1xyXG4gICAgcHVibGljIHRhcmdldExhbmd1YWdlKCk6IHN0cmluZyB7XHJcbiAgICAgICAgY29uc3QgeGxpZmZFbGVtID0gRE9NVXRpbGl0aWVzLmdldEZpcnN0RWxlbWVudEJ5VGFnTmFtZSh0aGlzLl9wYXJzZWREb2N1bWVudCwgJ3hsaWZmJyk7XHJcbiAgICAgICAgaWYgKHhsaWZmRWxlbSkge1xyXG4gICAgICAgICAgICByZXR1cm4geGxpZmZFbGVtLmdldEF0dHJpYnV0ZSgndHJnTGFuZycpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEVkaXQgdGhlIHRhcmdldCBsYW5ndWFnZS5cclxuICAgICAqIEBwYXJhbSBsYW5ndWFnZSBsYW5ndWFnZVxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgc2V0VGFyZ2V0TGFuZ3VhZ2UobGFuZ3VhZ2U6IHN0cmluZykge1xyXG4gICAgICAgIGNvbnN0IHhsaWZmRWxlbSA9IERPTVV0aWxpdGllcy5nZXRGaXJzdEVsZW1lbnRCeVRhZ05hbWUodGhpcy5fcGFyc2VkRG9jdW1lbnQsICd4bGlmZicpO1xyXG4gICAgICAgIGlmICh4bGlmZkVsZW0pIHtcclxuICAgICAgICAgICAgeGxpZmZFbGVtLnNldEF0dHJpYnV0ZSgndHJnTGFuZycsIGxhbmd1YWdlKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBBZGQgYSBuZXcgdHJhbnMtdW5pdCB0byB0aGlzIGZpbGUuXHJcbiAgICAgKiBUaGUgdHJhbnMgdW5pdCBzdGVtcyBmcm9tIGFub3RoZXIgZmlsZS5cclxuICAgICAqIEl0IGNvcGllcyB0aGUgc291cmNlIGNvbnRlbnQgb2YgdGhlIHR1IHRvIHRoZSB0YXJnZXQgY29udGVudCB0b28sXHJcbiAgICAgKiBkZXBlbmRpbmcgb24gdGhlIHZhbHVlcyBvZiBpc0RlZmF1bHRMYW5nIGFuZCBjb3B5Q29udGVudC5cclxuICAgICAqIFNvIHRoZSBzb3VyY2UgY2FuIGJlIHVzZWQgYXMgYSBkdW1teSB0cmFuc2xhdGlvbi5cclxuICAgICAqICh1c2VkIGJ5IHhsaWZmbWVyZ2UpXHJcbiAgICAgKiBAcGFyYW0gZm9yZWlnblRyYW5zVW5pdCB0aGUgdHJhbnMgdW5pdCB0byBiZSBpbXBvcnRlZC5cclxuICAgICAqIEBwYXJhbSBpc0RlZmF1bHRMYW5nIEZsYWcsIHdldGhlciBmaWxlIGNvbnRhaW5zIHRoZSBkZWZhdWx0IGxhbmd1YWdlLlxyXG4gICAgICogVGhlbiBzb3VyY2UgYW5kIHRhcmdldCBhcmUganVzdCBlcXVhbC5cclxuICAgICAqIFRoZSBjb250ZW50IHdpbGwgYmUgY29waWVkLlxyXG4gICAgICogU3RhdGUgd2lsbCBiZSBmaW5hbC5cclxuICAgICAqIEBwYXJhbSBjb3B5Q29udGVudCBGbGFnLCB3ZXRoZXIgdG8gY29weSBjb250ZW50IG9yIGxlYXZlIGl0IGVtcHR5LlxyXG4gICAgICogV2JlbiB0cnVlLCBjb250ZW50IHdpbGwgYmUgY29waWVkIGZyb20gc291cmNlLlxyXG4gICAgICogV2hlbiBmYWxzZSwgY29udGVudCB3aWxsIGJlIGxlZnQgZW1wdHkgKGlmIGl0IGlzIG5vdCB0aGUgZGVmYXVsdCBsYW5ndWFnZSkuXHJcbiAgICAgKiBAcGFyYW0gaW1wb3J0QWZ0ZXJFbGVtZW50IG9wdGlvbmFsIChzaW5jZSAxLjEwKSBvdGhlciB0cmFuc3VuaXQgKHBhcnQgb2YgdGhpcyBmaWxlKSwgdGhhdCBzaG91bGQgYmUgdXNlZCBhcyBhbmNlc3Rvci5cclxuICAgICAqIE5ld2x5IGltcG9ydGVkIHRyYW5zIHVuaXQgaXMgdGhlbiBpbnNlcnRlZCBkaXJlY3RseSBhZnRlciB0aGlzIGVsZW1lbnQuXHJcbiAgICAgKiBJZiBub3Qgc2V0IG9yIG5vdCBwYXJ0IG9mIHRoaXMgZmlsZSwgbmV3IHVuaXQgd2lsbCBiZSBpbXBvcnRlZCBhdCB0aGUgZW5kLlxyXG4gICAgICogSWYgZXhwbGljaXR5IHNldCB0byBudWxsLCBuZXcgdW5pdCB3aWxsIGJlIGltcG9ydGVkIGF0IHRoZSBzdGFydC5cclxuICAgICAqIEByZXR1cm4gdGhlIG5ld2x5IGltcG9ydGVkIHRyYW5zIHVuaXQgKHNpbmNlIHZlcnNpb24gMS43LjApXHJcbiAgICAgKiBAdGhyb3dzIGFuIGVycm9yIGlmIHRyYW5zLXVuaXQgd2l0aCBzYW1lIGlkIGFscmVhZHkgaXMgaW4gdGhlIGZpbGUuXHJcbiAgICAgKi9cclxuICAgIGltcG9ydE5ld1RyYW5zVW5pdChmb3JlaWduVHJhbnNVbml0OiBJVHJhbnNVbml0LCBpc0RlZmF1bHRMYW5nOiBib29sZWFuLCBjb3B5Q29udGVudDogYm9vbGVhbiwgaW1wb3J0QWZ0ZXJFbGVtZW50PzogSVRyYW5zVW5pdClcclxuICAgICAgICA6IElUcmFuc1VuaXQge1xyXG4gICAgICAgIGlmICh0aGlzLnRyYW5zVW5pdFdpdGhJZChmb3JlaWduVHJhbnNVbml0LmlkKSkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoZm9ybWF0KCd0dSB3aXRoIGlkICVzIGFscmVhZHkgZXhpc3RzIGluIGZpbGUsIGNhbm5vdCBpbXBvcnQgaXQnLCBmb3JlaWduVHJhbnNVbml0LmlkKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnN0IG5ld1R1ID0gKDxBYnN0cmFjdFRyYW5zVW5pdD4gZm9yZWlnblRyYW5zVW5pdCkuY2xvbmVXaXRoU291cmNlQXNUYXJnZXQoaXNEZWZhdWx0TGFuZywgY29weUNvbnRlbnQsIHRoaXMpO1xyXG4gICAgICAgIGNvbnN0IGZpbGVFbGVtZW50ID0gRE9NVXRpbGl0aWVzLmdldEZpcnN0RWxlbWVudEJ5VGFnTmFtZSh0aGlzLl9wYXJzZWREb2N1bWVudCwgJ2ZpbGUnKTtcclxuICAgICAgICBpZiAoIWZpbGVFbGVtZW50KSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihmb3JtYXQoJ0ZpbGUgXCIlc1wiIHNlZW1zIHRvIGJlIG5vIHhsaWZmIDIuMCBmaWxlIChzaG91bGQgY29udGFpbiBhIGZpbGUgZWxlbWVudCknLCB0aGlzLl9maWxlbmFtZSkpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBsZXQgaW5zZXJ0ZWQgPSBmYWxzZTtcclxuICAgICAgICBsZXQgaXNBZnRlckVsZW1lbnRQYXJ0T2ZGaWxlID0gZmFsc2U7XHJcbiAgICAgICAgaWYgKCEhaW1wb3J0QWZ0ZXJFbGVtZW50KSB7XHJcbiAgICAgICAgICAgIGNvbnN0IGluc2VydGlvblBvaW50ID0gdGhpcy50cmFuc1VuaXRXaXRoSWQoaW1wb3J0QWZ0ZXJFbGVtZW50LmlkKTtcclxuICAgICAgICAgICAgaWYgKCEhaW5zZXJ0aW9uUG9pbnQpIHtcclxuICAgICAgICAgICAgICAgIGlzQWZ0ZXJFbGVtZW50UGFydE9mRmlsZSA9IHRydWU7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGltcG9ydEFmdGVyRWxlbWVudCA9PT0gdW5kZWZpbmVkIHx8IChpbXBvcnRBZnRlckVsZW1lbnQgJiYgIWlzQWZ0ZXJFbGVtZW50UGFydE9mRmlsZSkpIHtcclxuICAgICAgICAgICAgZmlsZUVsZW1lbnQuYXBwZW5kQ2hpbGQobmV3VHUuYXNYbWxFbGVtZW50KCkpO1xyXG4gICAgICAgICAgICBpbnNlcnRlZCA9IHRydWU7XHJcbiAgICAgICAgfSBlbHNlIGlmIChpbXBvcnRBZnRlckVsZW1lbnQgPT09IG51bGwpIHtcclxuICAgICAgICAgICAgY29uc3QgZmlyc3RVbml0RWxlbWVudCA9IERPTVV0aWxpdGllcy5nZXRGaXJzdEVsZW1lbnRCeVRhZ05hbWUodGhpcy5fcGFyc2VkRG9jdW1lbnQsICd1bml0Jyk7XHJcbiAgICAgICAgICAgIGlmIChmaXJzdFVuaXRFbGVtZW50KSB7XHJcbiAgICAgICAgICAgICAgICBET01VdGlsaXRpZXMuaW5zZXJ0QmVmb3JlKG5ld1R1LmFzWG1sRWxlbWVudCgpLCBmaXJzdFVuaXRFbGVtZW50KTtcclxuICAgICAgICAgICAgICAgIGluc2VydGVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIC8vIG5vIHRyYW5zLXVuaXQsIGVtcHR5IGZpbGUsIHNvIGFkZCB0byBmaXJzdCBmaWxlIGVsZW1lbnRcclxuICAgICAgICAgICAgICAgIGZpbGVFbGVtZW50LmFwcGVuZENoaWxkKG5ld1R1LmFzWG1sRWxlbWVudCgpKTtcclxuICAgICAgICAgICAgICAgIGluc2VydGVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIGNvbnN0IHJlZlVuaXRFbGVtZW50ID0gRE9NVXRpbGl0aWVzLmdldEVsZW1lbnRCeVRhZ05hbWVBbmRJZCh0aGlzLl9wYXJzZWREb2N1bWVudCwgJ3VuaXQnLCBpbXBvcnRBZnRlckVsZW1lbnQuaWQpO1xyXG4gICAgICAgICAgICBpZiAocmVmVW5pdEVsZW1lbnQpIHtcclxuICAgICAgICAgICAgICAgIERPTVV0aWxpdGllcy5pbnNlcnRBZnRlcihuZXdUdS5hc1htbEVsZW1lbnQoKSwgcmVmVW5pdEVsZW1lbnQpO1xyXG4gICAgICAgICAgICAgICAgaW5zZXJ0ZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChpbnNlcnRlZCkge1xyXG4gICAgICAgICAgICB0aGlzLmxhenlJbml0aWFsaXplVHJhbnNVbml0cygpO1xyXG4gICAgICAgICAgICB0aGlzLnRyYW5zVW5pdHMucHVzaChuZXdUdSk7XHJcbiAgICAgICAgICAgIHRoaXMuY291bnROdW1iZXJzKCk7XHJcbiAgICAgICAgICAgIHJldHVybiBuZXdUdTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGUgYSBuZXcgdHJhbnNsYXRpb24gZmlsZSBmb3IgdGhpcyBmaWxlIGZvciBhIGdpdmVuIGxhbmd1YWdlLlxyXG4gICAgICogTm9ybWFsbHksIHRoaXMgaXMganVzdCBhIGNvcHkgb2YgdGhlIG9yaWdpbmFsIG9uZS5cclxuICAgICAqIEJ1dCBmb3IgWE1CIHRoZSB0cmFuc2xhdGlvbiBmaWxlIGhhcyBmb3JtYXQgJ1hUQicuXHJcbiAgICAgKiBAcGFyYW0gbGFuZyBMYW5ndWFnZSBjb2RlXHJcbiAgICAgKiBAcGFyYW0gZmlsZW5hbWUgZXhwZWN0ZWQgZmlsZW5hbWUgdG8gc3RvcmUgZmlsZVxyXG4gICAgICogQHBhcmFtIGlzRGVmYXVsdExhbmcgRmxhZywgd2V0aGVyIGZpbGUgY29udGFpbnMgdGhlIGRlZmF1bHQgbGFuZ3VhZ2UuXHJcbiAgICAgKiBUaGVuIHNvdXJjZSBhbmQgdGFyZ2V0IGFyZSBqdXN0IGVxdWFsLlxyXG4gICAgICogVGhlIGNvbnRlbnQgd2lsbCBiZSBjb3BpZWQuXHJcbiAgICAgKiBTdGF0ZSB3aWxsIGJlIGZpbmFsLlxyXG4gICAgICogQHBhcmFtIGNvcHlDb250ZW50IEZsYWcsIHdldGhlciB0byBjb3B5IGNvbnRlbnQgb3IgbGVhdmUgaXQgZW1wdHkuXHJcbiAgICAgKiBXYmVuIHRydWUsIGNvbnRlbnQgd2lsbCBiZSBjb3BpZWQgZnJvbSBzb3VyY2UuXHJcbiAgICAgKiBXaGVuIGZhbHNlLCBjb250ZW50IHdpbGwgYmUgbGVmdCBlbXB0eSAoaWYgaXQgaXMgbm90IHRoZSBkZWZhdWx0IGxhbmd1YWdlKS5cclxuICAgICAqL1xyXG4gICAgcHVibGljIGNyZWF0ZVRyYW5zbGF0aW9uRmlsZUZvckxhbmcobGFuZzogc3RyaW5nLCBmaWxlbmFtZTogc3RyaW5nLCBpc0RlZmF1bHRMYW5nOiBib29sZWFuLCBjb3B5Q29udGVudDogYm9vbGVhbiwgb3B0aW9uYWxNYXN0ZXI/OiB7eG1sQ29udGVudDogc3RyaW5nLCBwYXRoOiBzdHJpbmcsIGVuY29kaW5nOiBzdHJpbmd9KVxyXG4gICAgICAgIDogSVRyYW5zbGF0aW9uTWVzc2FnZXNGaWxlIHtcclxuICAgICAgICBjb25zdCB0cmFuc2xhdGlvbkZpbGUgPSBuZXcgWGxpZmYyRmlsZSh0aGlzLmVkaXRlZENvbnRlbnQoKSwgZmlsZW5hbWUsIHRoaXMuZW5jb2RpbmcoKSk7XHJcbiAgICAgICAgdHJhbnNsYXRpb25GaWxlLnNldE5ld1RyYW5zVW5pdFRhcmdldFByYWVmaXgodGhpcy50YXJnZXRQcmFlZml4KTtcclxuICAgICAgICB0cmFuc2xhdGlvbkZpbGUuc2V0TmV3VHJhbnNVbml0VGFyZ2V0U3VmZml4KHRoaXMudGFyZ2V0U3VmZml4KTtcclxuICAgICAgICB0cmFuc2xhdGlvbkZpbGUuc2V0VGFyZ2V0TGFuZ3VhZ2UobGFuZyk7XHJcbiAgICAgICAgdHJhbnNsYXRpb25GaWxlLmZvckVhY2hUcmFuc1VuaXQoKHRyYW5zVW5pdDogSVRyYW5zVW5pdCkgPT4ge1xyXG4gICAgICAgICAgICAoPEFic3RyYWN0VHJhbnNVbml0PiB0cmFuc1VuaXQpLnVzZVNvdXJjZUFzVGFyZ2V0KGlzRGVmYXVsdExhbmcsIGNvcHlDb250ZW50KTtcclxuICAgICAgICB9KTtcclxuICAgICAgICByZXR1cm4gdHJhbnNsYXRpb25GaWxlO1xyXG4gICAgfVxyXG59XHJcbiJdfQ==