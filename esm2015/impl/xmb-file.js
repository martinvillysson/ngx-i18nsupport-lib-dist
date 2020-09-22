import { FORMAT_XMB, FILETYPE_XMB, FORMAT_XTB } from '../api/constants';
import { format } from 'util';
import { XmbTransUnit } from './xmb-trans-unit';
import { AbstractTranslationMessagesFile } from './abstract-translation-messages-file';
/**
 * Created by martin on 10.03.2017.
 * xmb-File access.
 */
/**
 * Doctype of xtb translation file corresponding with thos xmb file.
 */
export const XTB_DOCTYPE = `<!DOCTYPE translationbundle [
  <!ELEMENT translationbundle (translation)*>
  <!ATTLIST translationbundle lang CDATA #REQUIRED>
  <!ELEMENT translation (#PCDATA|ph)*>
  <!ATTLIST translation id CDATA #REQUIRED>
  <!ELEMENT ph EMPTY>
  <!ATTLIST ph name CDATA #REQUIRED>
]>`;
export class XmbFile extends AbstractTranslationMessagesFile {
    /**
     * Create an xmb-File from source.
     * @param _translationMessageFileFactory factory to create a translation file (xtb) for the xmb file
     * @param xmlString file content
     * @param path Path to file
     * @param encoding optional encoding of the xml.
     * This is read from the file, but if you know it before, you can avoid reading the file twice.
     * @return XmbFile
     */
    constructor(_translationMessageFileFactory, xmlString, path, encoding) {
        super();
        this._translationMessageFileFactory = _translationMessageFileFactory;
        this._warnings = [];
        this._numberOfTransUnitsWithMissingId = 0;
        this.initializeFromContent(xmlString, path, encoding);
    }
    initializeFromContent(xmlString, path, encoding) {
        this.parseContent(xmlString, path, encoding);
        if (this._parsedDocument.getElementsByTagName('messagebundle').length !== 1) {
            throw new Error(format('File "%s" seems to be no xmb file (should contain a messagebundle element)', path));
        }
        return this;
    }
    initializeTransUnits() {
        this.transUnits = [];
        const transUnitsInFile = this._parsedDocument.getElementsByTagName('msg');
        for (let i = 0; i < transUnitsInFile.length; i++) {
            const msg = transUnitsInFile.item(i);
            const id = msg.getAttribute('id');
            if (!id) {
                this._warnings.push(format('oops, msg without "id" found in master, please check file %s', this._filename));
            }
            this.transUnits.push(new XmbTransUnit(msg, id, this));
        }
    }
    /**
     * File format as it is used in config files.
     * Currently 'xlf', 'xmb', 'xmb2'
     * Returns one of the constants FORMAT_..
     */
    i18nFormat() {
        return FORMAT_XMB;
    }
    /**
     * File type.
     * Here 'XMB'
     */
    fileType() {
        return FILETYPE_XMB;
    }
    /**
     * return tag names of all elements that have mixed content.
     * These elements will not be beautified.
     * Typical candidates are source and target.
     */
    elementsWithMixedContent() {
        return ['message'];
    }
    /**
     * Guess language from filename.
     * If filename is foo.xy.xmb, than language is assumed to be xy.
     * @return Language or null
     */
    guessLanguageFromFilename() {
        if (this._filename) {
            const parts = this._filename.split('.');
            if (parts.length > 2 && parts[parts.length - 1].toLowerCase() === 'xmb') {
                return parts[parts.length - 2];
            }
        }
        return null;
    }
    /**
     * Get source language.
     * Unsupported in xmb.
     * Try to guess it from filename if any..
     * @return source language.
     */
    sourceLanguage() {
        return this.guessLanguageFromFilename();
    }
    /**
     * Edit the source language.
     * Unsupported in xmb.
     * @param language language
     */
    setSourceLanguage(language) {
        // do nothing, xmb has no notation for this.
    }
    /**
     * Get target language.
     * Unsupported in xmb.
     * Try to guess it from filename if any..
     * @return target language.
     */
    targetLanguage() {
        return this.guessLanguageFromFilename();
    }
    /**
     * Edit the target language.
     * Unsupported in xmb.
     * @param language language
     */
    setTargetLanguage(language) {
        // do nothing, xmb has no notation for this.
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
        throw Error('xmb file cannot be used to store translations, use xtb file');
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
        const translationbundleXMLSource = '<?xml version="1.0" encoding="UTF-8"?>\n' + XTB_DOCTYPE + '\n<translationbundle>\n</translationbundle>\n';
        const translationFile = this._translationMessageFileFactory.createFileFromFileContent(FORMAT_XTB, translationbundleXMLSource, filename, this.encoding(), { xmlContent: this.editedContent(), path: this.filename(), encoding: this.encoding() });
        translationFile.setNewTransUnitTargetPraefix(this.targetPraefix);
        translationFile.setNewTransUnitTargetSuffix(this.targetSuffix);
        translationFile.setTargetLanguage(lang);
        translationFile.setNewTransUnitTargetPraefix(this.getNewTransUnitTargetPraefix());
        translationFile.setNewTransUnitTargetSuffix(this.getNewTransUnitTargetSuffix());
        this.forEachTransUnit((tu) => {
            translationFile.importNewTransUnit(tu, isDefaultLang, copyContent);
        });
        return translationFile;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoieG1iLWZpbGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9wcm9qZWN0cy9uZ3gtaTE4bnN1cHBvcnQtbGliL3NyYy9pbXBsL3htYi1maWxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUdBLE9BQU8sRUFBQyxVQUFVLEVBQUUsWUFBWSxFQUFFLFVBQVUsRUFBQyxNQUFNLGtCQUFrQixDQUFDO0FBQ3RFLE9BQU8sRUFBQyxNQUFNLEVBQUMsTUFBTSxNQUFNLENBQUM7QUFDNUIsT0FBTyxFQUFDLFlBQVksRUFBQyxNQUFNLGtCQUFrQixDQUFDO0FBQzlDLE9BQU8sRUFBQywrQkFBK0IsRUFBQyxNQUFNLHNDQUFzQyxDQUFDO0FBRXJGOzs7R0FHRztBQUVIOztHQUVHO0FBQ0gsTUFBTSxDQUFDLE1BQU0sV0FBVyxHQUFHOzs7Ozs7O0dBT3hCLENBQUM7QUFFSixNQUFNLE9BQU8sT0FBUSxTQUFRLCtCQUErQjtJQUV4RDs7Ozs7Ozs7T0FRRztJQUNILFlBQ1ksOEJBQStELEVBQ3ZFLFNBQWlCLEVBQUUsSUFBWSxFQUFFLFFBQWdCO1FBRWpELEtBQUssRUFBRSxDQUFDO1FBSEEsbUNBQThCLEdBQTlCLDhCQUE4QixDQUFpQztRQUl2RSxJQUFJLENBQUMsU0FBUyxHQUFHLEVBQUUsQ0FBQztRQUNwQixJQUFJLENBQUMsZ0NBQWdDLEdBQUcsQ0FBQyxDQUFDO1FBQzFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxTQUFTLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0lBQzFELENBQUM7SUFFTyxxQkFBcUIsQ0FBQyxTQUFpQixFQUFFLElBQVksRUFBRSxRQUFnQjtRQUMzRSxJQUFJLENBQUMsWUFBWSxDQUFDLFNBQVMsRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDN0MsSUFBSSxJQUFJLENBQUMsZUFBZSxDQUFDLG9CQUFvQixDQUFDLGVBQWUsQ0FBQyxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7WUFDekUs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QUFFLEVBQ3JELEVBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxhQUFhLEVBQUUsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLFFBQVEsRUFBRSxFQUFFLFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUSxFQUFFLEVBQUMsQ0FBQyxDQUFDO1FBQzFGLGVBQWUsQ0FBQyw0QkFBNEIsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDakUsZUFBZSxDQUFDLDJCQUEyQixDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUMvRCxlQUFlLENBQUMsaUJBQWlCLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDeEMsZUFBZSxDQUFDLDRCQUE0QixDQUFDLElBQUksQ0FBQyw0QkFBNEIsRUFBRSxDQUFDLENBQUM7UUFDbEYsZUFBZSxDQUFDLDJCQUEyQixDQUFDLElBQUksQ0FBQywyQkFBMkIsRUFBRSxDQUFDLENBQUM7UUFDaEYsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUU7WUFDekIsZUFBZSxDQUFDLGtCQUFrQixDQUFDLEVBQUUsRUFBRSxhQUFhLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFDdkUsQ0FBQyxDQUFDLENBQUM7UUFDSCxPQUFPLGVBQWUsQ0FBQztJQUMzQixDQUFDO0NBRUoiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge0lUcmFuc2xhdGlvbk1lc3NhZ2VzRmlsZUZhY3Rvcnl9IGZyb20gJy4uL2FwaS9pLXRyYW5zbGF0aW9uLW1lc3NhZ2VzLWZpbGUtZmFjdG9yeSc7XHJcbmltcG9ydCB7SVRyYW5zbGF0aW9uTWVzc2FnZXNGaWxlfSBmcm9tICcuLi9hcGkvaS10cmFuc2xhdGlvbi1tZXNzYWdlcy1maWxlJztcclxuaW1wb3J0IHtJVHJhbnNVbml0fSBmcm9tICcuLi9hcGkvaS10cmFucy11bml0JztcclxuaW1wb3J0IHtGT1JNQVRfWE1CLCBGSUxFVFlQRV9YTUIsIEZPUk1BVF9YVEJ9IGZyb20gJy4uL2FwaS9jb25zdGFudHMnO1xyXG5pbXBvcnQge2Zvcm1hdH0gZnJvbSAndXRpbCc7XHJcbmltcG9ydCB7WG1iVHJhbnNVbml0fSBmcm9tICcuL3htYi10cmFucy11bml0JztcclxuaW1wb3J0IHtBYnN0cmFjdFRyYW5zbGF0aW9uTWVzc2FnZXNGaWxlfSBmcm9tICcuL2Fic3RyYWN0LXRyYW5zbGF0aW9uLW1lc3NhZ2VzLWZpbGUnO1xyXG5cclxuLyoqXHJcbiAqIENyZWF0ZWQgYnkgbWFydGluIG9uIDEwLjAzLjIwMTcuXHJcbiAqIHhtYi1GaWxlIGFjY2Vzcy5cclxuICovXHJcblxyXG4vKipcclxuICogRG9jdHlwZSBvZiB4dGIgdHJhbnNsYXRpb24gZmlsZSBjb3JyZXNwb25kaW5nIHdpdGggdGhvcyB4bWIgZmlsZS5cclxuICovXHJcbmV4cG9ydCBjb25zdCBYVEJfRE9DVFlQRSA9IGA8IURPQ1RZUEUgdHJhbnNsYXRpb25idW5kbGUgW1xyXG4gIDwhRUxFTUVOVCB0cmFuc2xhdGlvbmJ1bmRsZSAodHJhbnNsYXRpb24pKj5cclxuICA8IUFUVExJU1QgdHJhbnNsYXRpb25idW5kbGUgbGFuZyBDREFUQSAjUkVRVUlSRUQ+XHJcbiAgPCFFTEVNRU5UIHRyYW5zbGF0aW9uICgjUENEQVRBfHBoKSo+XHJcbiAgPCFBVFRMSVNUIHRyYW5zbGF0aW9uIGlkIENEQVRBICNSRVFVSVJFRD5cclxuICA8IUVMRU1FTlQgcGggRU1QVFk+XHJcbiAgPCFBVFRMSVNUIHBoIG5hbWUgQ0RBVEEgI1JFUVVJUkVEPlxyXG5dPmA7XHJcblxyXG5leHBvcnQgY2xhc3MgWG1iRmlsZSBleHRlbmRzIEFic3RyYWN0VHJhbnNsYXRpb25NZXNzYWdlc0ZpbGUgaW1wbGVtZW50cyBJVHJhbnNsYXRpb25NZXNzYWdlc0ZpbGUge1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlIGFuIHhtYi1GaWxlIGZyb20gc291cmNlLlxyXG4gICAgICogQHBhcmFtIF90cmFuc2xhdGlvbk1lc3NhZ2VGaWxlRmFjdG9yeSBmYWN0b3J5IHRvIGNyZWF0ZSBhIHRyYW5zbGF0aW9uIGZpbGUgKHh0YikgZm9yIHRoZSB4bWIgZmlsZVxyXG4gICAgICogQHBhcmFtIHhtbFN0cmluZyBmaWxlIGNvbnRlbnRcclxuICAgICAqIEBwYXJhbSBwYXRoIFBhdGggdG8gZmlsZVxyXG4gICAgICogQHBhcmFtIGVuY29kaW5nIG9wdGlvbmFsIGVuY29kaW5nIG9mIHRoZSB4bWwuXHJcbiAgICAgKiBUaGlzIGlzIHJlYWQgZnJvbSB0aGUgZmlsZSwgYnV0IGlmIHlvdSBrbm93IGl0IGJlZm9yZSwgeW91IGNhbiBhdm9pZCByZWFkaW5nIHRoZSBmaWxlIHR3aWNlLlxyXG4gICAgICogQHJldHVybiBYbWJGaWxlXHJcbiAgICAgKi9cclxuICAgIGNvbnN0cnVjdG9yKFxyXG4gICAgICAgIHByaXZhdGUgX3RyYW5zbGF0aW9uTWVzc2FnZUZpbGVGYWN0b3J5OiBJVHJhbnNsYXRpb25NZXNzYWdlc0ZpbGVGYWN0b3J5LFxyXG4gICAgICAgIHhtbFN0cmluZzogc3RyaW5nLCBwYXRoOiBzdHJpbmcsIGVuY29kaW5nOiBzdHJpbmcpIHtcclxuXHJcbiAgICAgICAgc3VwZXIoKTtcclxuICAgICAgICB0aGlzLl93YXJuaW5ncyA9IFtdO1xyXG4gICAgICAgIHRoaXMuX251bWJlck9mVHJhbnNVbml0c1dpdGhNaXNzaW5nSWQgPSAwO1xyXG4gICAgICAgIHRoaXMuaW5pdGlhbGl6ZUZyb21Db250ZW50KHhtbFN0cmluZywgcGF0aCwgZW5jb2RpbmcpO1xyXG4gICAgfVxyXG5cclxuICAgIHByaXZhdGUgaW5pdGlhbGl6ZUZyb21Db250ZW50KHhtbFN0cmluZzogc3RyaW5nLCBwYXRoOiBzdHJpbmcsIGVuY29kaW5nOiBzdHJpbmcpOiBYbWJGaWxlIHtcclxuICAgICAgICB0aGlzLnBhcnNlQ29udGVudCh4bWxTdHJpbmcsIHBhdGgsIGVuY29kaW5nKTtcclxuICAgICAgICBpZiAodGhpcy5fcGFyc2VkRG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ21lc3NhZ2VidW5kbGUnKS5sZW5ndGggIT09IDEpIHtcclxuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKGZvcm1hdCgnRmlsZSBcIiVzXCIgc2VlbXMgdG8gYmUgbm8geG1iIGZpbGUgKHNob3VsZCBjb250YWluIGEgbWVzc2FnZWJ1bmRsZSBlbGVtZW50KScsIHBhdGgpKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgcmV0dXJuIHRoaXM7XHJcbiAgICB9XHJcblxyXG4gICAgcHJvdGVjdGVkIGluaXRpYWxpemVUcmFuc1VuaXRzKCkge1xyXG4gICAgICAgIHRoaXMudHJhbnNVbml0cyA9IFtdO1xyXG4gICAgICAgIGNvbnN0IHRyYW5zVW5pdHNJbkZpbGUgPSB0aGlzLl9wYXJzZWREb2N1bWVudC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnbXNnJyk7XHJcbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCB0cmFuc1VuaXRzSW5GaWxlLmxlbmd0aDsgaSsrKSB7XHJcbiAgICAgICAgICAgIGNvbnN0IG1zZyA9IHRyYW5zVW5pdHNJbkZpbGUuaXRlbShpKTtcclxuICAgICAgICAgICAgY29uc3QgaWQgPSBtc2cuZ2V0QXR0cmlidXRlKCdpZCcpO1xyXG4gICAgICAgICAgICBpZiAoIWlkKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl93YXJuaW5ncy5wdXNoKGZvcm1hdCgnb29wcywgbXNnIHdpdGhvdXQgXCJpZFwiIGZvdW5kIGluIG1hc3RlciwgcGxlYXNlIGNoZWNrIGZpbGUgJXMnLCB0aGlzLl9maWxlbmFtZSkpO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIHRoaXMudHJhbnNVbml0cy5wdXNoKG5ldyBYbWJUcmFuc1VuaXQobXNnLCBpZCwgdGhpcykpO1xyXG4gICAgICAgIH1cclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEZpbGUgZm9ybWF0IGFzIGl0IGlzIHVzZWQgaW4gY29uZmlnIGZpbGVzLlxyXG4gICAgICogQ3VycmVudGx5ICd4bGYnLCAneG1iJywgJ3htYjInXHJcbiAgICAgKiBSZXR1cm5zIG9uZSBvZiB0aGUgY29uc3RhbnRzIEZPUk1BVF8uLlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgaTE4bkZvcm1hdCgpOiBzdHJpbmcge1xyXG4gICAgICAgIHJldHVybiBGT1JNQVRfWE1CO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogRmlsZSB0eXBlLlxyXG4gICAgICogSGVyZSAnWE1CJ1xyXG4gICAgICovXHJcbiAgICBwdWJsaWMgZmlsZVR5cGUoKTogc3RyaW5nIHtcclxuICAgICAgICByZXR1cm4gRklMRVRZUEVfWE1CO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogcmV0dXJuIHRhZyBuYW1lcyBvZiBhbGwgZWxlbWVudHMgdGhhdCBoYXZlIG1peGVkIGNvbnRlbnQuXHJcbiAgICAgKiBUaGVzZSBlbGVtZW50cyB3aWxsIG5vdCBiZSBiZWF1dGlmaWVkLlxyXG4gICAgICogVHlwaWNhbCBjYW5kaWRhdGVzIGFyZSBzb3VyY2UgYW5kIHRhcmdldC5cclxuICAgICAqL1xyXG4gICAgcHJvdGVjdGVkIGVsZW1lbnRzV2l0aE1peGVkQ29udGVudCgpOiBzdHJpbmdbXSB7XHJcbiAgICAgICAgcmV0dXJuIFsnbWVzc2FnZSddO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogR3Vlc3MgbGFuZ3VhZ2UgZnJvbSBmaWxlbmFtZS5cclxuICAgICAqIElmIGZpbGVuYW1lIGlzIGZvby54eS54bWIsIHRoYW4gbGFuZ3VhZ2UgaXMgYXNzdW1lZCB0byBiZSB4eS5cclxuICAgICAqIEByZXR1cm4gTGFuZ3VhZ2Ugb3IgbnVsbFxyXG4gICAgICovXHJcbiAgICBwcml2YXRlIGd1ZXNzTGFuZ3VhZ2VGcm9tRmlsZW5hbWUoKTogc3RyaW5nIHtcclxuICAgICAgICBpZiAodGhpcy5fZmlsZW5hbWUpIHtcclxuICAgICAgICAgICAgY29uc3QgcGFydHM6IHN0cmluZ1tdID0gdGhpcy5fZmlsZW5hbWUuc3BsaXQoJy4nKTtcclxuICAgICAgICAgICAgaWYgKHBhcnRzLmxlbmd0aCA+IDIgJiYgcGFydHNbcGFydHMubGVuZ3RoIC0gMV0udG9Mb3dlckNhc2UoKSA9PT0gJ3htYicpIHtcclxuICAgICAgICAgICAgICAgIHJldHVybiBwYXJ0c1twYXJ0cy5sZW5ndGggLSAyXTtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEdldCBzb3VyY2UgbGFuZ3VhZ2UuXHJcbiAgICAgKiBVbnN1cHBvcnRlZCBpbiB4bWIuXHJcbiAgICAgKiBUcnkgdG8gZ3Vlc3MgaXQgZnJvbSBmaWxlbmFtZSBpZiBhbnkuLlxyXG4gICAgICogQHJldHVybiBzb3VyY2UgbGFuZ3VhZ2UuXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBzb3VyY2VMYW5ndWFnZSgpOiBzdHJpbmcge1xyXG4gICAgICAgIHJldHVybiB0aGlzLmd1ZXNzTGFuZ3VhZ2VGcm9tRmlsZW5hbWUoKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEVkaXQgdGhlIHNvdXJjZSBsYW5ndWFnZS5cclxuICAgICAqIFVuc3VwcG9ydGVkIGluIHhtYi5cclxuICAgICAqIEBwYXJhbSBsYW5ndWFnZSBsYW5ndWFnZVxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgc2V0U291cmNlTGFuZ3VhZ2UobGFuZ3VhZ2U6IHN0cmluZykge1xyXG4gICAgICAgIC8vIGRvIG5vdGhpbmcsIHhtYiBoYXMgbm8gbm90YXRpb24gZm9yIHRoaXMuXHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBHZXQgdGFyZ2V0IGxhbmd1YWdlLlxyXG4gICAgICogVW5zdXBwb3J0ZWQgaW4geG1iLlxyXG4gICAgICogVHJ5IHRvIGd1ZXNzIGl0IGZyb20gZmlsZW5hbWUgaWYgYW55Li5cclxuICAgICAqIEByZXR1cm4gdGFyZ2V0IGxhbmd1YWdlLlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgdGFyZ2V0TGFuZ3VhZ2UoKTogc3RyaW5nIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5ndWVzc0xhbmd1YWdlRnJvbUZpbGVuYW1lKCk7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBFZGl0IHRoZSB0YXJnZXQgbGFuZ3VhZ2UuXHJcbiAgICAgKiBVbnN1cHBvcnRlZCBpbiB4bWIuXHJcbiAgICAgKiBAcGFyYW0gbGFuZ3VhZ2UgbGFuZ3VhZ2VcclxuICAgICAqL1xyXG4gICAgcHVibGljIHNldFRhcmdldExhbmd1YWdlKGxhbmd1YWdlOiBzdHJpbmcpIHtcclxuICAgICAgICAvLyBkbyBub3RoaW5nLCB4bWIgaGFzIG5vIG5vdGF0aW9uIGZvciB0aGlzLlxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQWRkIGEgbmV3IHRyYW5zLXVuaXQgdG8gdGhpcyBmaWxlLlxyXG4gICAgICogVGhlIHRyYW5zIHVuaXQgc3RlbXMgZnJvbSBhbm90aGVyIGZpbGUuXHJcbiAgICAgKiBJdCBjb3BpZXMgdGhlIHNvdXJjZSBjb250ZW50IG9mIHRoZSB0dSB0byB0aGUgdGFyZ2V0IGNvbnRlbnQgdG9vLFxyXG4gICAgICogZGVwZW5kaW5nIG9uIHRoZSB2YWx1ZXMgb2YgaXNEZWZhdWx0TGFuZyBhbmQgY29weUNvbnRlbnQuXHJcbiAgICAgKiBTbyB0aGUgc291cmNlIGNhbiBiZSB1c2VkIGFzIGEgZHVtbXkgdHJhbnNsYXRpb24uXHJcbiAgICAgKiAodXNlZCBieSB4bGlmZm1lcmdlKVxyXG4gICAgICogQHBhcmFtIGZvcmVpZ25UcmFuc1VuaXQgdGhlIHRyYW5zIHVuaXQgdG8gYmUgaW1wb3J0ZWQuXHJcbiAgICAgKiBAcGFyYW0gaXNEZWZhdWx0TGFuZyBGbGFnLCB3ZXRoZXIgZmlsZSBjb250YWlucyB0aGUgZGVmYXVsdCBsYW5ndWFnZS5cclxuICAgICAqIFRoZW4gc291cmNlIGFuZCB0YXJnZXQgYXJlIGp1c3QgZXF1YWwuXHJcbiAgICAgKiBUaGUgY29udGVudCB3aWxsIGJlIGNvcGllZC5cclxuICAgICAqIFN0YXRlIHdpbGwgYmUgZmluYWwuXHJcbiAgICAgKiBAcGFyYW0gY29weUNvbnRlbnQgRmxhZywgd2V0aGVyIHRvIGNvcHkgY29udGVudCBvciBsZWF2ZSBpdCBlbXB0eS5cclxuICAgICAqIFdiZW4gdHJ1ZSwgY29udGVudCB3aWxsIGJlIGNvcGllZCBmcm9tIHNvdXJjZS5cclxuICAgICAqIFdoZW4gZmFsc2UsIGNvbnRlbnQgd2lsbCBiZSBsZWZ0IGVtcHR5IChpZiBpdCBpcyBub3QgdGhlIGRlZmF1bHQgbGFuZ3VhZ2UpLlxyXG4gICAgICogQHBhcmFtIGltcG9ydEFmdGVyRWxlbWVudCBvcHRpb25hbCAoc2luY2UgMS4xMCkgb3RoZXIgdHJhbnN1bml0IChwYXJ0IG9mIHRoaXMgZmlsZSksIHRoYXQgc2hvdWxkIGJlIHVzZWQgYXMgYW5jZXN0b3IuXHJcbiAgICAgKiBOZXdseSBpbXBvcnRlZCB0cmFucyB1bml0IGlzIHRoZW4gaW5zZXJ0ZWQgZGlyZWN0bHkgYWZ0ZXIgdGhpcyBlbGVtZW50LlxyXG4gICAgICogSWYgbm90IHNldCBvciBub3QgcGFydCBvZiB0aGlzIGZpbGUsIG5ldyB1bml0IHdpbGwgYmUgaW1wb3J0ZWQgYXQgdGhlIGVuZC5cclxuICAgICAqIElmIGV4cGxpY2l0eSBzZXQgdG8gbnVsbCwgbmV3IHVuaXQgd2lsbCBiZSBpbXBvcnRlZCBhdCB0aGUgc3RhcnQuXHJcbiAgICAgKiBAcmV0dXJuIHRoZSBuZXdseSBpbXBvcnRlZCB0cmFucyB1bml0IChzaW5jZSB2ZXJzaW9uIDEuNy4wKVxyXG4gICAgICogQHRocm93cyBhbiBlcnJvciBpZiB0cmFucy11bml0IHdpdGggc2FtZSBpZCBhbHJlYWR5IGlzIGluIHRoZSBmaWxlLlxyXG4gICAgICovXHJcbiAgICBpbXBvcnROZXdUcmFuc1VuaXQoZm9yZWlnblRyYW5zVW5pdDogSVRyYW5zVW5pdCwgaXNEZWZhdWx0TGFuZzogYm9vbGVhbiwgY29weUNvbnRlbnQ6IGJvb2xlYW4sIGltcG9ydEFmdGVyRWxlbWVudD86IElUcmFuc1VuaXQpXHJcbiAgICAgICAgOiBJVHJhbnNVbml0IHtcclxuICAgICAgICB0aHJvdyBFcnJvcigneG1iIGZpbGUgY2Fubm90IGJlIHVzZWQgdG8gc3RvcmUgdHJhbnNsYXRpb25zLCB1c2UgeHRiIGZpbGUnKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIENyZWF0ZSBhIG5ldyB0cmFuc2xhdGlvbiBmaWxlIGZvciB0aGlzIGZpbGUgZm9yIGEgZ2l2ZW4gbGFuZ3VhZ2UuXHJcbiAgICAgKiBOb3JtYWxseSwgdGhpcyBpcyBqdXN0IGEgY29weSBvZiB0aGUgb3JpZ2luYWwgb25lLlxyXG4gICAgICogQnV0IGZvciBYTUIgdGhlIHRyYW5zbGF0aW9uIGZpbGUgaGFzIGZvcm1hdCAnWFRCJy5cclxuICAgICAqIEBwYXJhbSBsYW5nIExhbmd1YWdlIGNvZGVcclxuICAgICAqIEBwYXJhbSBmaWxlbmFtZSBleHBlY3RlZCBmaWxlbmFtZSB0byBzdG9yZSBmaWxlXHJcbiAgICAgKiBAcGFyYW0gaXNEZWZhdWx0TGFuZyBGbGFnLCB3ZXRoZXIgZmlsZSBjb250YWlucyB0aGUgZGVmYXVsdCBsYW5ndWFnZS5cclxuICAgICAqIFRoZW4gc291cmNlIGFuZCB0YXJnZXQgYXJlIGp1c3QgZXF1YWwuXHJcbiAgICAgKiBUaGUgY29udGVudCB3aWxsIGJlIGNvcGllZC5cclxuICAgICAqIFN0YXRlIHdpbGwgYmUgZmluYWwuXHJcbiAgICAgKiBAcGFyYW0gY29weUNvbnRlbnQgRmxhZywgd2V0aGVyIHRvIGNvcHkgY29udGVudCBvciBsZWF2ZSBpdCBlbXB0eS5cclxuICAgICAqIFdiZW4gdHJ1ZSwgY29udGVudCB3aWxsIGJlIGNvcGllZCBmcm9tIHNvdXJjZS5cclxuICAgICAqIFdoZW4gZmFsc2UsIGNvbnRlbnQgd2lsbCBiZSBsZWZ0IGVtcHR5IChpZiBpdCBpcyBub3QgdGhlIGRlZmF1bHQgbGFuZ3VhZ2UpLlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgY3JlYXRlVHJhbnNsYXRpb25GaWxlRm9yTGFuZyhsYW5nOiBzdHJpbmcsIGZpbGVuYW1lOiBzdHJpbmcsIGlzRGVmYXVsdExhbmc6IGJvb2xlYW4sIGNvcHlDb250ZW50OiBib29sZWFuLCBvcHRpb25hbE1hc3Rlcj86IHt4bWxDb250ZW50OiBzdHJpbmcsIHBhdGg6IHN0cmluZywgZW5jb2Rpbmc6IHN0cmluZ30pXHJcbiAgICAgICAgOiBJVHJhbnNsYXRpb25NZXNzYWdlc0ZpbGUge1xyXG4gICAgICAgIGNvbnN0IHRyYW5zbGF0aW9uYnVuZGxlWE1MU291cmNlID1cclxuICAgICAgICAgICAgJzw/eG1sIHZlcnNpb249XCIxLjBcIiBlbmNvZGluZz1cIlVURi04XCI/PlxcbicgKyBYVEJfRE9DVFlQRSArICdcXG48dHJhbnNsYXRpb25idW5kbGU+XFxuPC90cmFuc2xhdGlvbmJ1bmRsZT5cXG4nO1xyXG4gICAgICAgIGNvbnN0IHRyYW5zbGF0aW9uRmlsZSA9IHRoaXMuX3RyYW5zbGF0aW9uTWVzc2FnZUZpbGVGYWN0b3J5LmNyZWF0ZUZpbGVGcm9tRmlsZUNvbnRlbnQoXHJcbiAgICAgICAgICAgIEZPUk1BVF9YVEIsXHJcbiAgICAgICAgICAgIHRyYW5zbGF0aW9uYnVuZGxlWE1MU291cmNlLCBmaWxlbmFtZSwgdGhpcy5lbmNvZGluZygpLFxyXG4gICAgICAgICAgICB7eG1sQ29udGVudDogdGhpcy5lZGl0ZWRDb250ZW50KCksIHBhdGg6IHRoaXMuZmlsZW5hbWUoKSwgZW5jb2Rpbmc6IHRoaXMuZW5jb2RpbmcoKX0pO1xyXG4gICAgICAgIHRyYW5zbGF0aW9uRmlsZS5zZXROZXdUcmFuc1VuaXRUYXJnZXRQcmFlZml4KHRoaXMudGFyZ2V0UHJhZWZpeCk7XHJcbiAgICAgICAgdHJhbnNsYXRpb25GaWxlLnNldE5ld1RyYW5zVW5pdFRhcmdldFN1ZmZpeCh0aGlzLnRhcmdldFN1ZmZpeCk7XHJcbiAgICAgICAgdHJhbnNsYXRpb25GaWxlLnNldFRhcmdldExhbmd1YWdlKGxhbmcpO1xyXG4gICAgICAgIHRyYW5zbGF0aW9uRmlsZS5zZXROZXdUcmFuc1VuaXRUYXJnZXRQcmFlZml4KHRoaXMuZ2V0TmV3VHJhbnNVbml0VGFyZ2V0UHJhZWZpeCgpKTtcclxuICAgICAgICB0cmFuc2xhdGlvbkZpbGUuc2V0TmV3VHJhbnNVbml0VGFyZ2V0U3VmZml4KHRoaXMuZ2V0TmV3VHJhbnNVbml0VGFyZ2V0U3VmZml4KCkpO1xyXG4gICAgICAgIHRoaXMuZm9yRWFjaFRyYW5zVW5pdCgodHUpID0+IHtcclxuICAgICAgICAgICAgdHJhbnNsYXRpb25GaWxlLmltcG9ydE5ld1RyYW5zVW5pdCh0dSwgaXNEZWZhdWx0TGFuZywgY29weUNvbnRlbnQpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICAgIHJldHVybiB0cmFuc2xhdGlvbkZpbGU7XHJcbiAgICB9XHJcblxyXG59XHJcbiJdfQ==