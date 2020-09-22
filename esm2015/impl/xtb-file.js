import { FORMAT_XTB, FILETYPE_XTB, FORMAT_XMB } from '../api/constants';
import { format } from 'util';
import { DOMUtilities } from './dom-utilities';
import { AbstractTranslationMessagesFile } from './abstract-translation-messages-file';
import { XtbTransUnit } from './xtb-trans-unit';
/**
 * Created by martin on 23.05.2017.
 * xtb-File access.
 * xtb is the translated counterpart to xmb.
 */
export class XtbFile extends AbstractTranslationMessagesFile {
    /**
     * Create an xmb-File from source.
     * @param _translationMessageFileFactory factory to create a translation file (xtb) for the xmb file
     * @param xmlString file content
     * @param path Path to file
     * @param encoding optional encoding of the xml.
     * This is read from the file, but if you know it before, you can avoid reading the file twice.
     * @param optionalMaster in case of xmb the master file, that contains the original texts.
     * (this is used to support state infos, that are based on comparing original with translated version)
     * @return XmbFile
     */
    constructor(_translationMessageFileFactory, xmlString, path, encoding, optionalMaster) {
        super();
        this._translationMessageFileFactory = _translationMessageFileFactory;
        this._warnings = [];
        this._numberOfTransUnitsWithMissingId = 0;
        this.initializeFromContent(xmlString, path, encoding, optionalMaster);
    }
    initializeFromContent(xmlString, path, encoding, optionalMaster) {
        this.parseContent(xmlString, path, encoding);
        if (this._parsedDocument.getElementsByTagName('translationbundle').length !== 1) {
            throw new Error(format('File "%s" seems to be no xtb file (should contain a translationbundle element)', path));
        }
        if (optionalMaster) {
            try {
                this._masterFile = this._translationMessageFileFactory.createFileFromFileContent(FORMAT_XMB, optionalMaster.xmlContent, optionalMaster.path, optionalMaster.encoding);
                // check, wether this can be the master ...
                const numberInMaster = this._masterFile.numberOfTransUnits();
                const myNumber = this.numberOfTransUnits();
                if (numberInMaster !== myNumber) {
                    this._warnings.push(format('%s trans units found in master, but this file has %s. Check if it is the correct master', numberInMaster, myNumber));
                }
            }
            catch (error) {
                throw new Error(format('File "%s" seems to be no xmb file. An xtb file needs xmb as master file.', optionalMaster.path));
            }
        }
        return this;
    }
    initializeTransUnits() {
        this.transUnits = [];
        const transUnitsInFile = this._parsedDocument.getElementsByTagName('translation');
        for (let i = 0; i < transUnitsInFile.length; i++) {
            const msg = transUnitsInFile.item(i);
            const id = msg.getAttribute('id');
            if (!id) {
                this._warnings.push(format('oops, msg without "id" found in master, please check file %s', this._filename));
            }
            let masterUnit = null;
            if (this._masterFile) {
                masterUnit = this._masterFile.transUnitWithId(id);
            }
            this.transUnits.push(new XtbTransUnit(msg, id, this, masterUnit));
        }
    }
    /**
     * File format as it is used in config files.
     * Currently 'xlf', 'xlf2', 'xmb', 'xtb'
     * Returns one of the constants FORMAT_..
     */
    i18nFormat() {
        return FORMAT_XTB;
    }
    /**
     * File type.
     * Here 'XTB'
     */
    fileType() {
        return FILETYPE_XTB;
    }
    /**
     * return tag names of all elements that have mixed content.
     * These elements will not be beautified.
     * Typical candidates are source and target.
     */
    elementsWithMixedContent() {
        return ['translation'];
    }
    /**
     * Get source language.
     * Unsupported in xmb/xtb.
     * Try to guess it from master filename if any..
     * @return source language.
     */
    sourceLanguage() {
        if (this._masterFile) {
            return this._masterFile.sourceLanguage();
        }
        else {
            return null;
        }
    }
    /**
     * Edit the source language.
     * Unsupported in xmb/xtb.
     * @param language language
     */
    setSourceLanguage(language) {
        // do nothing, xtb has no notation for this.
    }
    /**
     * Get target language.
     * @return target language.
     */
    targetLanguage() {
        const translationbundleElem = DOMUtilities.getFirstElementByTagName(this._parsedDocument, 'translationbundle');
        if (translationbundleElem) {
            return translationbundleElem.getAttribute('lang');
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
        const translationbundleElem = DOMUtilities.getFirstElementByTagName(this._parsedDocument, 'translationbundle');
        if (translationbundleElem) {
            translationbundleElem.setAttribute('lang', language);
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
        const newMasterTu = foreignTransUnit.cloneWithSourceAsTarget(isDefaultLang, copyContent, this);
        const translationbundleElem = DOMUtilities.getFirstElementByTagName(this._parsedDocument, 'translationbundle');
        if (!translationbundleElem) {
            throw new Error(format('File "%s" seems to be no xtb file (should contain a translationbundle element)', this._filename));
        }
        const translationElement = translationbundleElem.ownerDocument.createElement('translation');
        translationElement.setAttribute('id', foreignTransUnit.id);
        let newContent = (copyContent || isDefaultLang) ? foreignTransUnit.sourceContent() : '';
        if (!foreignTransUnit.isICUMessage(newContent)) {
            newContent = this.getNewTransUnitTargetPraefix() + newContent + this.getNewTransUnitTargetSuffix();
        }
        DOMUtilities.replaceContentWithXMLContent(translationElement, newContent);
        const newTu = new XtbTransUnit(translationElement, foreignTransUnit.id, this, newMasterTu);
        let inserted = false;
        let isAfterElementPartOfFile = false;
        if (!!importAfterElement) {
            const insertionPoint = this.transUnitWithId(importAfterElement.id);
            if (!!insertionPoint) {
                isAfterElementPartOfFile = true;
            }
        }
        if (importAfterElement === undefined || (importAfterElement && !isAfterElementPartOfFile)) {
            translationbundleElem.appendChild(newTu.asXmlElement());
            inserted = true;
        }
        else if (importAfterElement === null) {
            const firstTranslationElement = DOMUtilities.getFirstElementByTagName(this._parsedDocument, 'translation');
            if (firstTranslationElement) {
                DOMUtilities.insertBefore(newTu.asXmlElement(), firstTranslationElement);
                inserted = true;
            }
            else {
                // no trans-unit, empty file, so add to bundle at end
                translationbundleElem.appendChild(newTu.asXmlElement());
                inserted = true;
            }
        }
        else {
            const refUnitElement = DOMUtilities.getElementByTagNameAndId(this._parsedDocument, 'translation', importAfterElement.id);
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
        throw new Error(format('File "%s", xtb files are not translatable, they are already translations', filename));
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieHRiLWZpbGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9wcm9qZWN0cy9uZ3gtaTE4bnN1cHBvcnQtbGliL3NyYy9pbXBsL3h0Yi1maWxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUdBLE9BQU8sRUFBQyxVQUFVLEVBQUUsWUFBWSxFQUFFLFVBQVUsRUFBQyxNQUFNLGtCQUFrQixDQUFDO0FBQ3RFLE9BQU8sRUFBQyxNQUFNLEVBQUMsTUFBTSxNQUFNLENBQUM7QUFDNUIsT0FBTyxFQUFDLFlBQVksRUFBQyxNQUFNLGlCQUFpQixDQUFDO0FBQzdDLE9BQU8sRUFBQywrQkFBK0IsRUFBQyxNQUFNLHNDQUFzQyxDQUFDO0FBQ3JGLE9BQU8sRUFBQyxZQUFZLEVBQUMsTUFBTSxrQkFBa0IsQ0FBQztBQUU5Qzs7OztHQUlHO0FBRUgsTUFBTSxPQUFPLE9BQVEsU0FBUSwrQkFBK0I7SUFNeEQ7Ozs7Ozs7Ozs7T0FVRztJQUNILFlBQW9CLDhCQUErRCxFQUN2RSxTQUFpQixFQUFFLElBQVksRUFBRSxRQUFnQixFQUNqRCxjQUF1RTtRQUMvRSxLQUFLLEVBQUUsQ0FBQztRQUhRLG1DQUE4QixHQUE5Qiw4QkFBOEIsQ0FBaUM7UUFJL0UsSUFBSSxDQUFDLFNBQVMsR0FBRyxFQUFFLENBQUM7UUFDcEIsSUFBSSxDQUFDLGdDQUFnQyxHQUFHLENBQUMsQ0FBQztRQUMxQyxJQUFJLENBQUMscUJBQXFCLENBQUMsU0FBUyxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsY0FBYyxDQUFDLENBQUM7SUFDMUUsQ0FBQztJQUVPLHFCQUFxQixDQUFDLFNBQWlCLEVBQUUsSUFBWSxFQUFFLFFBQWdCLEVBQ2pELGNBQXVFO1FBQ2pHLElBQUksQ0FBQyxZQUFZLENBQUMsU0FBUyxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQztRQUM3QyxJQUFJLElBQUksQ0FBQyxlQUFlLENBQUMsb0JBQW9CLENBQUMsbUJBQW1CLENBQUMsQ0FBQyxN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LEVBQUUsUUFBUSxDQUFDLENBQUMsQ0FBQztJQUNsSCxDQUFDO0NBQ0oiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge0lUcmFuc2xhdGlvbk1lc3NhZ2VzRmlsZUZhY3Rvcnl9IGZyb20gJy4uL2FwaS9pLXRyYW5zbGF0aW9uLW1lc3NhZ2VzLWZpbGUtZmFjdG9yeSc7XHJcbmltcG9ydCB7SVRyYW5zbGF0aW9uTWVzc2FnZXNGaWxlfSBmcm9tICcuLi9hcGkvaS10cmFuc2xhdGlvbi1tZXNzYWdlcy1maWxlJztcclxuaW1wb3J0IHtJVHJhbnNVbml0fSBmcm9tICcuLi9hcGkvaS10cmFucy11bml0JztcclxuaW1wb3J0IHtGT1JNQVRfWFRCLCBGSUxFVFlQRV9YVEIsIEZPUk1BVF9YTUJ9IGZyb20gJy4uL2FwaS9jb25zdGFudHMnO1xyXG5pbXBvcnQge2Zvcm1hdH0gZnJvbSAndXRpbCc7XHJcbmltcG9ydCB7RE9NVXRpbGl0aWVzfSBmcm9tICcuL2RvbS11dGlsaXRpZXMnO1xyXG5pbXBvcnQge0Fic3RyYWN0VHJhbnNsYXRpb25NZXNzYWdlc0ZpbGV9IGZyb20gJy4vYWJzdHJhY3QtdHJhbnNsYXRpb24tbWVzc2FnZXMtZmlsZSc7XHJcbmltcG9ydCB7WHRiVHJhbnNVbml0fSBmcm9tICcuL3h0Yi10cmFucy11bml0JztcclxuaW1wb3J0IHtBYnN0cmFjdFRyYW5zVW5pdH0gZnJvbSAnLi9hYnN0cmFjdC10cmFucy11bml0JztcclxuLyoqXHJcbiAqIENyZWF0ZWQgYnkgbWFydGluIG9uIDIzLjA1LjIwMTcuXHJcbiAqIHh0Yi1GaWxlIGFjY2Vzcy5cclxuICogeHRiIGlzIHRoZSB0cmFuc2xhdGVkIGNvdW50ZXJwYXJ0IHRvIHhtYi5cclxuICovXHJcblxyXG5leHBvcnQgY2xhc3MgWHRiRmlsZSBleHRlbmRzIEFic3RyYWN0VHJhbnNsYXRpb25NZXNzYWdlc0ZpbGUgaW1wbGVtZW50cyBJVHJhbnNsYXRpb25NZXNzYWdlc0ZpbGUge1xyXG5cclxuICAgIC8vIGF0dGFjaGVkIG1hc3RlciBmaWxlLCBpZiBhbnlcclxuICAgIC8vIHVzZWQgYXMgc291cmNlIHRvIGRldGVybWluZSBzdGF0ZSAuLi5cclxuICAgIHByaXZhdGUgX21hc3RlckZpbGU6IElUcmFuc2xhdGlvbk1lc3NhZ2VzRmlsZTsgLy8gYW4geG1iLWZpbGVcclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZSBhbiB4bWItRmlsZSBmcm9tIHNvdXJjZS5cclxuICAgICAqIEBwYXJhbSBfdHJhbnNsYXRpb25NZXNzYWdlRmlsZUZhY3RvcnkgZmFjdG9yeSB0byBjcmVhdGUgYSB0cmFuc2xhdGlvbiBmaWxlICh4dGIpIGZvciB0aGUgeG1iIGZpbGVcclxuICAgICAqIEBwYXJhbSB4bWxTdHJpbmcgZmlsZSBjb250ZW50XHJcbiAgICAgKiBAcGFyYW0gcGF0aCBQYXRoIHRvIGZpbGVcclxuICAgICAqIEBwYXJhbSBlbmNvZGluZyBvcHRpb25hbCBlbmNvZGluZyBvZiB0aGUgeG1sLlxyXG4gICAgICogVGhpcyBpcyByZWFkIGZyb20gdGhlIGZpbGUsIGJ1dCBpZiB5b3Uga25vdyBpdCBiZWZvcmUsIHlvdSBjYW4gYXZvaWQgcmVhZGluZyB0aGUgZmlsZSB0d2ljZS5cclxuICAgICAqIEBwYXJhbSBvcHRpb25hbE1hc3RlciBpbiBjYXNlIG9mIHhtYiB0aGUgbWFzdGVyIGZpbGUsIHRoYXQgY29udGFpbnMgdGhlIG9yaWdpbmFsIHRleHRzLlxyXG4gICAgICogKHRoaXMgaXMgdXNlZCB0byBzdXBwb3J0IHN0YXRlIGluZm9zLCB0aGF0IGFyZSBiYXNlZCBvbiBjb21wYXJpbmcgb3JpZ2luYWwgd2l0aCB0cmFuc2xhdGVkIHZlcnNpb24pXHJcbiAgICAgKiBAcmV0dXJuIFhtYkZpbGVcclxuICAgICAqL1xyXG4gICAgY29uc3RydWN0b3IocHJpdmF0ZSBfdHJhbnNsYXRpb25NZXNzYWdlRmlsZUZhY3Rvcnk6IElUcmFuc2xhdGlvbk1lc3NhZ2VzRmlsZUZhY3RvcnksXHJcbiAgICAgICAgICAgICAgICB4bWxTdHJpbmc6IHN0cmluZywgcGF0aDogc3RyaW5nLCBlbmNvZGluZzogc3RyaW5nLFxyXG4gICAgICAgICAgICAgICAgb3B0aW9uYWxNYXN0ZXI/OiB7IHhtbENvbnRlbnQ6IHN0cmluZywgcGF0aDogc3RyaW5nLCBlbmNvZGluZzogc3RyaW5nIH0pIHtcclxuICAgICAgICBzdXBlcigpO1xyXG4gICAgICAgIHRoaXMuX3dhcm5pbmdzID0gW107XHJcbiAgICAgICAgdGhpcy5fbnVtYmVyT2ZUcmFuc1VuaXRzV2l0aE1pc3NpbmdJZCA9IDA7XHJcbiAgICAgICAgdGhpcy5pbml0aWFsaXplRnJvbUNvbnRlbnQoeG1sU3RyaW5nLCBwYXRoLCBlbmNvZGluZywgb3B0aW9uYWxNYXN0ZXIpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgaW5pdGlhbGl6ZUZyb21Db250ZW50KHhtbFN0cmluZzogc3RyaW5nLCBwYXRoOiBzdHJpbmcsIGVuY29kaW5nOiBzdHJpbmcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25hbE1hc3Rlcj86IHsgeG1sQ29udGVudDogc3RyaW5nLCBwYXRoOiBzdHJpbmcsIGVuY29kaW5nOiBzdHJpbmcgfSk6IFh0YkZpbGUge1xyXG4gICAgICAgIHRoaXMucGFyc2VDb250ZW50KHhtbFN0cmluZywgcGF0aCwgZW5jb2RpbmcpO1xyXG4gICAgICAgIGlmICh0aGlzLl9wYXJzZWREb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgndHJhbnNsYXRpb25idW5kbGUnKS5sZW5ndGggIT09IDEpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGZvcm1hdCgnRmlsZSBcIiVzXCIgc2VlbXMgdG8gYmUgbm8geHRiIGZpbGUgKHNob3VsZCBjb250YWluIGEgdHJhbnNsYXRpb25idW5kbGUgZWxlbWVudCknLCBwYXRoKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChvcHRpb25hbE1hc3Rlcikge1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fbWFzdGVyRmlsZSA9IHRoaXMuX3RyYW5zbGF0aW9uTWVzc2FnZUZpbGVGYWN0b3J5LmNyZWF0ZUZpbGVGcm9tRmlsZUNvbnRlbnQoXHJcbiAgICAgICAgICAgICAgICAgICAgRk9STUFUX1hNQixcclxuICAgICAgICAgICAgICAgICAgICBvcHRpb25hbE1hc3Rlci54bWxDb250ZW50LFxyXG4gICAgICAgICAgICAgICAgICAgIG9wdGlvbmFsTWFzdGVyLnBhdGgsXHJcbiAgICAgICAgICAgICAgICAgICAgb3B0aW9uYWxNYXN0ZXIuZW5jb2RpbmcpO1xyXG4gICAgICAgICAgICAgICAgLy8gY2hlY2ssIHdldGhlciB0aGlzIGNhbiBiZSB0aGUgbWFzdGVyIC4uLlxyXG4gICAgICAgICAgICAgICAgY29uc3QgbnVtYmVySW5NYXN0ZXIgPSB0aGlzLl9tYXN0ZXJGaWxlLm51bWJlck9mVHJhbnNVbml0cygpO1xyXG4gICAgICAgICAgICAgICAgY29uc3QgbXlOdW1iZXIgPSB0aGlzLm51bWJlck9mVHJhbnNVbml0cygpO1xyXG4gICAgICAgICAgICAgICAgaWYgKG51bWJlckluTWFzdGVyICE9PSBteU51bWJlcikge1xyXG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX3dhcm5pbmdzLnB1c2goZm9ybWF0KFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAnJXMgdHJhbnMgdW5pdHMgZm91bmQgaW4gbWFzdGVyLCBidXQgdGhpcyBmaWxlIGhhcyAlcy4gQ2hlY2sgaWYgaXQgaXMgdGhlIGNvcnJlY3QgbWFzdGVyJyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgbnVtYmVySW5NYXN0ZXIsIG15TnVtYmVyKSk7XHJcbiAgICAgICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XHJcbiAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoZm9ybWF0KCdGaWxlIFwiJXNcIiBzZWVtcyB0byBiZSBubyB4bWIgZmlsZS4gQW4geHRiIGZpbGUgbmVlZHMgeG1iIGFzIG1hc3RlciBmaWxlLicsIG9wdGlvbmFsTWFzdGVyLnBhdGgpKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gdGhpcztcclxuICAgIH1cclxuXHJcbiAgICBwcm90ZWN0ZWQgaW5pdGlhbGl6ZVRyYW5zVW5pdHMoKSB7XHJcbiAgICAgICAgdGhpcy50cmFuc1VuaXRzID0gW107XHJcbiAgICAgICAgY29uc3QgdHJhbnNVbml0c0luRmlsZSA9IHRoaXMuX3BhcnNlZERvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCd0cmFuc2xhdGlvbicpO1xyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdHJhbnNVbml0c0luRmlsZS5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBjb25zdCBtc2cgPSB0cmFuc1VuaXRzSW5GaWxlLml0ZW0oaSk7XHJcbiAgICAgICAgICAgIGNvbnN0IGlkID0gbXNnLmdldEF0dHJpYnV0ZSgnaWQnKTtcclxuICAgICAgICAgICAgaWYgKCFpZCkge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fd2FybmluZ3MucHVzaChmb3JtYXQoJ29vcHMsIG1zZyB3aXRob3V0IFwiaWRcIiBmb3VuZCBpbiBtYXN0ZXIsIHBsZWFzZSBjaGVjayBmaWxlICVzJywgdGhpcy5fZmlsZW5hbWUpKTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBsZXQgbWFzdGVyVW5pdDogSVRyYW5zVW5pdCA9IG51bGw7XHJcbiAgICAgICAgICAgIGlmICh0aGlzLl9tYXN0ZXJGaWxlKSB7XHJcbiAgICAgICAgICAgICAgICBtYXN0ZXJVbml0ID0gdGhpcy5fbWFzdGVyRmlsZS50cmFuc1VuaXRXaXRoSWQoaWQpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRoaXMudHJhbnNVbml0cy5wdXNoKG5ldyBYdGJUcmFuc1VuaXQobXNnLCBpZCwgdGhpcywgPEFic3RyYWN0VHJhbnNVbml0PiBtYXN0ZXJVbml0KSk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogRmlsZSBmb3JtYXQgYXMgaXQgaXMgdXNlZCBpbiBjb25maWcgZmlsZXMuXHJcbiAgICAgKiBDdXJyZW50bHkgJ3hsZicsICd4bGYyJywgJ3htYicsICd4dGInXHJcbiAgICAgKiBSZXR1cm5zIG9uZSBvZiB0aGUgY29uc3RhbnRzIEZPUk1BVF8uLlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgaTE4bkZvcm1hdCgpOiBzdHJpbmcge1xyXG4gICAgICAgIHJldHVybiBGT1JNQVRfWFRCO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogRmlsZSB0eXBlLlxyXG4gICAgICogSGVyZSAnWFRCJ1xyXG4gICAgICovXHJcbiAgICBwdWJsaWMgZmlsZVR5cGUoKTogc3RyaW5nIHtcclxuICAgICAgICByZXR1cm4gRklMRVRZUEVfWFRCO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogcmV0dXJuIHRhZyBuYW1lcyBvZiBhbGwgZWxlbWVudHMgdGhhdCBoYXZlIG1peGVkIGNvbnRlbnQuXHJcbiAgICAgKiBUaGVzZSBlbGVtZW50cyB3aWxsIG5vdCBiZSBiZWF1dGlmaWVkLlxyXG4gICAgICogVHlwaWNhbCBjYW5kaWRhdGVzIGFyZSBzb3VyY2UgYW5kIHRhcmdldC5cclxuICAgICAqL1xyXG4gICAgcHJvdGVjdGVkIGVsZW1lbnRzV2l0aE1peGVkQ29udGVudCgpOiBzdHJpbmdbXSB7XHJcbiAgICAgICAgcmV0dXJuIFsndHJhbnNsYXRpb24nXTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEdldCBzb3VyY2UgbGFuZ3VhZ2UuXHJcbiAgICAgKiBVbnN1cHBvcnRlZCBpbiB4bWIveHRiLlxyXG4gICAgICogVHJ5IHRvIGd1ZXNzIGl0IGZyb20gbWFzdGVyIGZpbGVuYW1lIGlmIGFueS4uXHJcbiAgICAgKiBAcmV0dXJuIHNvdXJjZSBsYW5ndWFnZS5cclxuICAgICAqL1xyXG4gICAgcHVibGljIHNvdXJjZUxhbmd1YWdlKCk6IHN0cmluZyB7XHJcbiAgICAgICAgaWYgKHRoaXMuX21hc3RlckZpbGUpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMuX21hc3RlckZpbGUuc291cmNlTGFuZ3VhZ2UoKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBFZGl0IHRoZSBzb3VyY2UgbGFuZ3VhZ2UuXHJcbiAgICAgKiBVbnN1cHBvcnRlZCBpbiB4bWIveHRiLlxyXG4gICAgICogQHBhcmFtIGxhbmd1YWdlIGxhbmd1YWdlXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBzZXRTb3VyY2VMYW5ndWFnZShsYW5ndWFnZTogc3RyaW5nKSB7XHJcbiAgICAgICAgLy8gZG8gbm90aGluZywgeHRiIGhhcyBubyBub3RhdGlvbiBmb3IgdGhpcy5cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEdldCB0YXJnZXQgbGFuZ3VhZ2UuXHJcbiAgICAgKiBAcmV0dXJuIHRhcmdldCBsYW5ndWFnZS5cclxuICAgICAqL1xyXG4gICAgcHVibGljIHRhcmdldExhbmd1YWdlKCk6IHN0cmluZyB7XHJcbiAgICAgICAgY29uc3QgdHJhbnNsYXRpb25idW5kbGVFbGVtID0gRE9NVXRpbGl0aWVzLmdldEZpcnN0RWxlbWVudEJ5VGFnTmFtZSh0aGlzLl9wYXJzZWREb2N1bWVudCwgJ3RyYW5zbGF0aW9uYnVuZGxlJyk7XHJcbiAgICAgICAgaWYgKHRyYW5zbGF0aW9uYnVuZGxlRWxlbSkge1xyXG4gICAgICAgICAgICByZXR1cm4gdHJhbnNsYXRpb25idW5kbGVFbGVtLmdldEF0dHJpYnV0ZSgnbGFuZycpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHJldHVybiBudWxsO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEVkaXQgdGhlIHRhcmdldCBsYW5ndWFnZS5cclxuICAgICAqIEBwYXJhbSBsYW5ndWFnZSBsYW5ndWFnZVxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgc2V0VGFyZ2V0TGFuZ3VhZ2UobGFuZ3VhZ2U6IHN0cmluZykge1xyXG4gICAgICAgIGNvbnN0IHRyYW5zbGF0aW9uYnVuZGxlRWxlbSA9IERPTVV0aWxpdGllcy5nZXRGaXJzdEVsZW1lbnRCeVRhZ05hbWUodGhpcy5fcGFyc2VkRG9jdW1lbnQsICd0cmFuc2xhdGlvbmJ1bmRsZScpO1xyXG4gICAgICAgIGlmICh0cmFuc2xhdGlvbmJ1bmRsZUVsZW0pIHtcclxuICAgICAgICAgICAgdHJhbnNsYXRpb25idW5kbGVFbGVtLnNldEF0dHJpYnV0ZSgnbGFuZycsIGxhbmd1YWdlKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBBZGQgYSBuZXcgdHJhbnMtdW5pdCB0byB0aGlzIGZpbGUuXHJcbiAgICAgKiBUaGUgdHJhbnMgdW5pdCBzdGVtcyBmcm9tIGFub3RoZXIgZmlsZS5cclxuICAgICAqIEl0IGNvcGllcyB0aGUgc291cmNlIGNvbnRlbnQgb2YgdGhlIHR1IHRvIHRoZSB0YXJnZXQgY29udGVudCB0b28sXHJcbiAgICAgKiBkZXBlbmRpbmcgb24gdGhlIHZhbHVlcyBvZiBpc0RlZmF1bHRMYW5nIGFuZCBjb3B5Q29udGVudC5cclxuICAgICAqIFNvIHRoZSBzb3VyY2UgY2FuIGJlIHVzZWQgYXMgYSBkdW1teSB0cmFuc2xhdGlvbi5cclxuICAgICAqICh1c2VkIGJ5IHhsaWZmbWVyZ2UpXHJcbiAgICAgKiBAcGFyYW0gZm9yZWlnblRyYW5zVW5pdCB0aGUgdHJhbnMgdW5pdCB0byBiZSBpbXBvcnRlZC5cclxuICAgICAqIEBwYXJhbSBpc0RlZmF1bHRMYW5nIEZsYWcsIHdldGhlciBmaWxlIGNvbnRhaW5zIHRoZSBkZWZhdWx0IGxhbmd1YWdlLlxyXG4gICAgICogVGhlbiBzb3VyY2UgYW5kIHRhcmdldCBhcmUganVzdCBlcXVhbC5cclxuICAgICAqIFRoZSBjb250ZW50IHdpbGwgYmUgY29waWVkLlxyXG4gICAgICogU3RhdGUgd2lsbCBiZSBmaW5hbC5cclxuICAgICAqIEBwYXJhbSBjb3B5Q29udGVudCBGbGFnLCB3ZXRoZXIgdG8gY29weSBjb250ZW50IG9yIGxlYXZlIGl0IGVtcHR5LlxyXG4gICAgICogV2JlbiB0cnVlLCBjb250ZW50IHdpbGwgYmUgY29waWVkIGZyb20gc291cmNlLlxyXG4gICAgICogV2hlbiBmYWxzZSwgY29udGVudCB3aWxsIGJlIGxlZnQgZW1wdHkgKGlmIGl0IGlzIG5vdCB0aGUgZGVmYXVsdCBsYW5ndWFnZSkuXHJcbiAgICAgKiBAcGFyYW0gaW1wb3J0QWZ0ZXJFbGVtZW50IG9wdGlvbmFsIChzaW5jZSAxLjEwKSBvdGhlciB0cmFuc3VuaXQgKHBhcnQgb2YgdGhpcyBmaWxlKSwgdGhhdCBzaG91bGQgYmUgdXNlZCBhcyBhbmNlc3Rvci5cclxuICAgICAqIE5ld2x5IGltcG9ydGVkIHRyYW5zIHVuaXQgaXMgdGhlbiBpbnNlcnRlZCBkaXJlY3RseSBhZnRlciB0aGlzIGVsZW1lbnQuXHJcbiAgICAgKiBJZiBub3Qgc2V0IG9yIG5vdCBwYXJ0IG9mIHRoaXMgZmlsZSwgbmV3IHVuaXQgd2lsbCBiZSBpbXBvcnRlZCBhdCB0aGUgZW5kLlxyXG4gICAgICogSWYgZXhwbGljaXR5IHNldCB0byBudWxsLCBuZXcgdW5pdCB3aWxsIGJlIGltcG9ydGVkIGF0IHRoZSBzdGFydC5cclxuICAgICAqIEByZXR1cm4gdGhlIG5ld2x5IGltcG9ydGVkIHRyYW5zIHVuaXQgKHNpbmNlIHZlcnNpb24gMS43LjApXHJcbiAgICAgKiBAdGhyb3dzIGFuIGVycm9yIGlmIHRyYW5zLXVuaXQgd2l0aCBzYW1lIGlkIGFscmVhZHkgaXMgaW4gdGhlIGZpbGUuXHJcbiAgICAgKi9cclxuICAgIGltcG9ydE5ld1RyYW5zVW5pdChmb3JlaWduVHJhbnNVbml0OiBJVHJhbnNVbml0LCBpc0RlZmF1bHRMYW5nOiBib29sZWFuLCBjb3B5Q29udGVudDogYm9vbGVhbiwgaW1wb3J0QWZ0ZXJFbGVtZW50PzogSVRyYW5zVW5pdClcclxuICAgICAgICA6IElUcmFuc1VuaXQge1xyXG4gICAgICAgIGlmICh0aGlzLnRyYW5zVW5pdFdpdGhJZChmb3JlaWduVHJhbnNVbml0LmlkKSkge1xyXG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoZm9ybWF0KCd0dSB3aXRoIGlkICVzIGFscmVhZHkgZXhpc3RzIGluIGZpbGUsIGNhbm5vdCBpbXBvcnQgaXQnLCBmb3JlaWduVHJhbnNVbml0LmlkKSk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnN0IG5ld01hc3RlclR1ID0gKDxBYnN0cmFjdFRyYW5zVW5pdD4gZm9yZWlnblRyYW5zVW5pdCkuY2xvbmVXaXRoU291cmNlQXNUYXJnZXQoaXNEZWZhdWx0TGFuZywgY29weUNvbnRlbnQsIHRoaXMpO1xyXG4gICAgICAgIGNvbnN0IHRyYW5zbGF0aW9uYnVuZGxlRWxlbSA9IERPTVV0aWxpdGllcy5nZXRGaXJzdEVsZW1lbnRCeVRhZ05hbWUodGhpcy5fcGFyc2VkRG9jdW1lbnQsICd0cmFuc2xhdGlvbmJ1bmRsZScpO1xyXG4gICAgICAgIGlmICghdHJhbnNsYXRpb25idW5kbGVFbGVtKSB7XHJcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihmb3JtYXQoJ0ZpbGUgXCIlc1wiIHNlZW1zIHRvIGJlIG5vIHh0YiBmaWxlIChzaG91bGQgY29udGFpbiBhIHRyYW5zbGF0aW9uYnVuZGxlIGVsZW1lbnQpJywgdGhpcy5fZmlsZW5hbWUpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgY29uc3QgdHJhbnNsYXRpb25FbGVtZW50ID0gdHJhbnNsYXRpb25idW5kbGVFbGVtLm93bmVyRG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndHJhbnNsYXRpb24nKTtcclxuICAgICAgICB0cmFuc2xhdGlvbkVsZW1lbnQuc2V0QXR0cmlidXRlKCdpZCcsIGZvcmVpZ25UcmFuc1VuaXQuaWQpO1xyXG4gICAgICAgIGxldCBuZXdDb250ZW50ID0gKGNvcHlDb250ZW50IHx8IGlzRGVmYXVsdExhbmcpID8gZm9yZWlnblRyYW5zVW5pdC5zb3VyY2VDb250ZW50KCkgOiAnJztcclxuICAgICAgICBpZiAoISg8QWJzdHJhY3RUcmFuc1VuaXQ+IGZvcmVpZ25UcmFuc1VuaXQpLmlzSUNVTWVzc2FnZShuZXdDb250ZW50KSkge1xyXG4gICAgICAgICAgICBuZXdDb250ZW50ID0gdGhpcy5nZXROZXdUcmFuc1VuaXRUYXJnZXRQcmFlZml4KCkgKyBuZXdDb250ZW50ICsgdGhpcy5nZXROZXdUcmFuc1VuaXRUYXJnZXRTdWZmaXgoKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgRE9NVXRpbGl0aWVzLnJlcGxhY2VDb250ZW50V2l0aFhNTENvbnRlbnQodHJhbnNsYXRpb25FbGVtZW50LCBuZXdDb250ZW50KTtcclxuICAgICAgICBjb25zdCBuZXdUdSA9IG5ldyBYdGJUcmFuc1VuaXQodHJhbnNsYXRpb25FbGVtZW50LCBmb3JlaWduVHJhbnNVbml0LmlkLCB0aGlzLCBuZXdNYXN0ZXJUdSk7XHJcbiAgICAgICAgbGV0IGluc2VydGVkID0gZmFsc2U7XHJcbiAgICAgICAgbGV0IGlzQWZ0ZXJFbGVtZW50UGFydE9mRmlsZSA9IGZhbHNlO1xyXG4gICAgICAgIGlmICghIWltcG9ydEFmdGVyRWxlbWVudCkge1xyXG4gICAgICAgICAgICBjb25zdCBpbnNlcnRpb25Qb2ludCA9IHRoaXMudHJhbnNVbml0V2l0aElkKGltcG9ydEFmdGVyRWxlbWVudC5pZCk7XHJcbiAgICAgICAgICAgIGlmICghIWluc2VydGlvblBvaW50KSB7XHJcbiAgICAgICAgICAgICAgICBpc0FmdGVyRWxlbWVudFBhcnRPZkZpbGUgPSB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChpbXBvcnRBZnRlckVsZW1lbnQgPT09IHVuZGVmaW5lZCB8fCAoaW1wb3J0QWZ0ZXJFbGVtZW50ICYmICFpc0FmdGVyRWxlbWVudFBhcnRPZkZpbGUpKSB7XHJcbiAgICAgICAgICAgIHRyYW5zbGF0aW9uYnVuZGxlRWxlbS5hcHBlbmRDaGlsZChuZXdUdS5hc1htbEVsZW1lbnQoKSk7XHJcbiAgICAgICAgICAgIGluc2VydGVkID0gdHJ1ZTtcclxuICAgICAgICB9IGVsc2UgaWYgKGltcG9ydEFmdGVyRWxlbWVudCA9PT0gbnVsbCkge1xyXG4gICAgICAgICAgICBjb25zdCBmaXJzdFRyYW5zbGF0aW9uRWxlbWVudCA9IERPTVV0aWxpdGllcy5nZXRGaXJzdEVsZW1lbnRCeVRhZ05hbWUodGhpcy5fcGFyc2VkRG9jdW1lbnQsICd0cmFuc2xhdGlvbicpO1xyXG4gICAgICAgICAgICBpZiAoZmlyc3RUcmFuc2xhdGlvbkVsZW1lbnQpIHtcclxuICAgICAgICAgICAgICAgIERPTVV0aWxpdGllcy5pbnNlcnRCZWZvcmUobmV3VHUuYXNYbWxFbGVtZW50KCksIGZpcnN0VHJhbnNsYXRpb25FbGVtZW50KTtcclxuICAgICAgICAgICAgICAgIGluc2VydGVkID0gdHJ1ZTtcclxuICAgICAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgICAgIC8vIG5vIHRyYW5zLXVuaXQsIGVtcHR5IGZpbGUsIHNvIGFkZCB0byBidW5kbGUgYXQgZW5kXHJcbiAgICAgICAgICAgICAgICB0cmFuc2xhdGlvbmJ1bmRsZUVsZW0uYXBwZW5kQ2hpbGQobmV3VHUuYXNYbWxFbGVtZW50KCkpO1xyXG4gICAgICAgICAgICAgICAgaW5zZXJ0ZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgICAgY29uc3QgcmVmVW5pdEVsZW1lbnQgPSBET01VdGlsaXRpZXMuZ2V0RWxlbWVudEJ5VGFnTmFtZUFuZElkKHRoaXMuX3BhcnNlZERvY3VtZW50LCAndHJhbnNsYXRpb24nLCBpbXBvcnRBZnRlckVsZW1lbnQuaWQpO1xyXG4gICAgICAgICAgICBpZiAocmVmVW5pdEVsZW1lbnQpIHtcclxuICAgICAgICAgICAgICAgIERPTVV0aWxpdGllcy5pbnNlcnRBZnRlcihuZXdUdS5hc1htbEVsZW1lbnQoKSwgcmVmVW5pdEVsZW1lbnQpO1xyXG4gICAgICAgICAgICAgICAgaW5zZXJ0ZWQgPSB0cnVlO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChpbnNlcnRlZCkge1xyXG4gICAgICAgICAgICB0aGlzLmxhenlJbml0aWFsaXplVHJhbnNVbml0cygpO1xyXG4gICAgICAgICAgICB0aGlzLnRyYW5zVW5pdHMucHVzaChuZXdUdSk7XHJcbiAgICAgICAgICAgIHRoaXMuY291bnROdW1iZXJzKCk7XHJcbiAgICAgICAgICAgIHJldHVybiBuZXdUdTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBDcmVhdGUgYSBuZXcgdHJhbnNsYXRpb24gZmlsZSBmb3IgdGhpcyBmaWxlIGZvciBhIGdpdmVuIGxhbmd1YWdlLlxyXG4gICAgICogTm9ybWFsbHksIHRoaXMgaXMganVzdCBhIGNvcHkgb2YgdGhlIG9yaWdpbmFsIG9uZS5cclxuICAgICAqIEJ1dCBmb3IgWE1CIHRoZSB0cmFuc2xhdGlvbiBmaWxlIGhhcyBmb3JtYXQgJ1hUQicuXHJcbiAgICAgKiBAcGFyYW0gbGFuZyBMYW5ndWFnZSBjb2RlXHJcbiAgICAgKiBAcGFyYW0gZmlsZW5hbWUgZXhwZWN0ZWQgZmlsZW5hbWUgdG8gc3RvcmUgZmlsZVxyXG4gICAgICogQHBhcmFtIGlzRGVmYXVsdExhbmcgRmxhZywgd2V0aGVyIGZpbGUgY29udGFpbnMgdGhlIGRlZmF1bHQgbGFuZ3VhZ2UuXHJcbiAgICAgKiBUaGVuIHNvdXJjZSBhbmQgdGFyZ2V0IGFyZSBqdXN0IGVxdWFsLlxyXG4gICAgICogVGhlIGNvbnRlbnQgd2lsbCBiZSBjb3BpZWQuXHJcbiAgICAgKiBTdGF0ZSB3aWxsIGJlIGZpbmFsLlxyXG4gICAgICogQHBhcmFtIGNvcHlDb250ZW50IEZsYWcsIHdldGhlciB0byBjb3B5IGNvbnRlbnQgb3IgbGVhdmUgaXQgZW1wdHkuXHJcbiAgICAgKiBXYmVuIHRydWUsIGNvbnRlbnQgd2lsbCBiZSBjb3BpZWQgZnJvbSBzb3VyY2UuXHJcbiAgICAgKiBXaGVuIGZhbHNlLCBjb250ZW50IHdpbGwgYmUgbGVmdCBlbXB0eSAoaWYgaXQgaXMgbm90IHRoZSBkZWZhdWx0IGxhbmd1YWdlKS5cclxuICAgICAqL1xyXG4gICAgcHVibGljIGNyZWF0ZVRyYW5zbGF0aW9uRmlsZUZvckxhbmcobGFuZzogc3RyaW5nLCBmaWxlbmFtZTogc3RyaW5nLCBpc0RlZmF1bHRMYW5nOiBib29sZWFuLCBjb3B5Q29udGVudDogYm9vbGVhbiwgb3B0aW9uYWxNYXN0ZXI/OiB7eG1sQ29udGVudDogc3RyaW5nLCBwYXRoOiBzdHJpbmcsIGVuY29kaW5nOiBzdHJpbmd9KVxyXG4gICAgICAgIDogSVRyYW5zbGF0aW9uTWVzc2FnZXNGaWxlIHtcclxuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoZm9ybWF0KCdGaWxlIFwiJXNcIiwgeHRiIGZpbGVzIGFyZSBub3QgdHJhbnNsYXRhYmxlLCB0aGV5IGFyZSBhbHJlYWR5IHRyYW5zbGF0aW9ucycsIGZpbGVuYW1lKSk7XHJcbiAgICB9XHJcbn1cclxuIl19