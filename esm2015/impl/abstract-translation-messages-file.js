import { STATE_NEW, STATE_TRANSLATED } from '../api/constants';
import { isNullOrUndefined } from 'util';
import { DOMParser } from 'xmldom';
import { XmlSerializer } from './xml-serializer';
/**
 * Created by roobm on 09.05.2017.
 * Abstract superclass for all implementations of ITranslationMessagesFile.
 */
export class AbstractTranslationMessagesFile {
    constructor() {
        this.transUnits = null;
        this._warnings = [];
    }
    /**
     * Parse file content.
     * Sets _parsedDocument, line ending, encoding, etc.
     * @param xmlString xmlString
     * @param path path
     * @param encoding encoding
     * @param optionalMaster optionalMaster
     */
    parseContent(xmlString, path, encoding, optionalMaster) {
        this._filename = path;
        this._encoding = encoding;
        this._parsedDocument = new DOMParser().parseFromString(xmlString, 'text/xml');
        if (optionalMaster) {
            this._parsedOptionalMasterDocument = new DOMParser().parseFromString(optionalMaster.xmlContent, 'text/xml');
        }
        this._fileEndsWithEOL = xmlString.endsWith('\n');
    }
    lazyInitializeTransUnits() {
        if (isNullOrUndefined(this.transUnits)) {
            this.initializeTransUnits();
            this.countNumbers();
        }
    }
    /**
     * count units after changes of trans units
     */
    countNumbers() {
        this._numberOfTransUnitsWithMissingId = 0;
        this._numberOfUntranslatedTransUnits = 0;
        this._numberOfReviewedTransUnits = 0;
        this.forEachTransUnit((tu) => {
            if (isNullOrUndefined(tu.id) || tu.id === '') {
                this._numberOfTransUnitsWithMissingId++;
            }
            const state = tu.targetState();
            if (isNullOrUndefined(state) || state === STATE_NEW) {
                this._numberOfUntranslatedTransUnits++;
            }
            if (state === STATE_TRANSLATED) {
                this._numberOfReviewedTransUnits++;
            }
        });
    }
    warnings() {
        this.lazyInitializeTransUnits();
        return this._warnings;
    }
    /**
     * Total number of translation units found in the file.
     */
    numberOfTransUnits() {
        this.lazyInitializeTransUnits();
        return this.transUnits.length;
    }
    /**
     * Number of translation units without translation found in the file.
     * These units have state 'translated'.
     */
    numberOfUntranslatedTransUnits() {
        this.lazyInitializeTransUnits();
        return this._numberOfUntranslatedTransUnits;
    }
    /**
     * Number of translation units with state 'final'.
     */
    numberOfReviewedTransUnits() {
        this.lazyInitializeTransUnits();
        return this._numberOfReviewedTransUnits;
    }
    /**
     * Number of translation units without translation found in the file.
     * These units have state 'translated'.
     */
    numberOfTransUnitsWithMissingId() {
        this.lazyInitializeTransUnits();
        return this._numberOfTransUnitsWithMissingId;
    }
    /**
     * Loop over all Translation Units.
     * @param callback callback
     */
    forEachTransUnit(callback) {
        this.lazyInitializeTransUnits();
        this.transUnits.forEach((tu) => callback(tu));
    }
    /**
     * Get trans-unit with given id.
     * @param id id
     * @return trans-unit with given id.
     */
    transUnitWithId(id) {
        this.lazyInitializeTransUnits();
        return this.transUnits.find((tu) => tu.id === id);
    }
    /**
     * Get optional trans-unit with given id.
     * @param id id
     * @return trans-unit with given id.
     */
    optionalMasterTransUnitWithId(id) {
        this.lazyInitializeTransUnits();
        if (this.optionalMasterTransUnits && this.optionalMasterTransUnits.length > 0) {
            return this.optionalMasterTransUnits.find((tu) => tu.id === id);
        }
        return null;
    }
    /**
     * Set the praefix used when copying source to target.
     * This is used by importNewTransUnit and createTranslationFileForLang methods.
     * (since 1.8.0)
     * @param targetPraefix targetPraefix
     */
    setNewTransUnitTargetPraefix(targetPraefix) {
        this.targetPraefix = targetPraefix;
    }
    /**
     * Get the praefix used when copying source to target.
     * (since 1.8.0)
     * @return the praefix used when copying source to target.
     */
    getNewTransUnitTargetPraefix() {
        return isNullOrUndefined(this.targetPraefix) ? '' : this.targetPraefix;
    }
    /**
     * Set the suffix used when copying source to target.
     * This is used by importNewTransUnit and createTranslationFileForLang methods.
     * (since 1.8.0)
     * @param targetSuffix targetSuffix
     */
    setNewTransUnitTargetSuffix(targetSuffix) {
        this.targetSuffix = targetSuffix;
    }
    /**
     * Get the suffix used when copying source to target.
     * (since 1.8.0)
     * @return the suffix used when copying source to target.
     */
    getNewTransUnitTargetSuffix() {
        return isNullOrUndefined(this.targetSuffix) ? '' : this.targetSuffix;
    }
    /**
     * Remove the trans-unit with the given id.
     * @param id id
     */
    removeTransUnitWithId(id) {
        const tuNode = this._parsedDocument.getElementById(id);
        if (tuNode) {
            tuNode.parentNode.removeChild(tuNode);
            this.lazyInitializeTransUnits();
            this.transUnits = this.transUnits.filter((tu) => tu.id !== id);
            this.countNumbers();
        }
    }
    /**
     * The filename where the data is read from.
     */
    filename() {
        return this._filename;
    }
    /**
     * The encoding if the xml content (UTF-8, ISO-8859-1, ...)
     */
    encoding() {
        return this._encoding;
    }
    /**
     * The xml content to be saved after changes are made.
     * @param beautifyOutput Flag whether to use pretty-data to format the output.
     * XMLSerializer produces some correct but strangely formatted output, which pretty-data can correct.
     * See issue #64 for details.
     * Default is false.
     */
    editedContent(beautifyOutput) {
        const options = {};
        if (beautifyOutput === true) {
            options.beautify = true;
            options.indentString = '  ';
            options.mixedContentElements = this.elementsWithMixedContent();
        }
        const result = new XmlSerializer().serializeToString(this._parsedDocument, options);
        if (this._fileEndsWithEOL) {
            // add eol if there was eol in original source
            return result + '\n';
        }
        else {
            return result;
        }
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYWJzdHJhY3QtdHJhbnNsYXRpb24tbWVzc2FnZXMtZmlsZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3Byb2plY3RzL25neC1pMThuc3VwcG9ydC1saWIvc3JjL2ltcGwvYWJzdHJhY3QtdHJhbnNsYXRpb24tbWVzc2FnZXMtZmlsZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsU0FBUyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sa0JBQWtCLENBQUM7QUFJL0QsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sTUFBTSxDQUFDO0FBQ3pDLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFDbkMsT0FBTyxFQUFFLGFBQWEsRUFBd0IsTUFBTSxrQkFBa0IsQ0FBQztBQUN2RTs7O0dBR0c7QUFFSCxNQUFNLE9BQWdCLCtCQUErQjtJQTZCakQ7UUFDSSxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQztRQUN2QixJQUFJLENBQUMsU0FBUyxHQUFHLEVBQUUsQ0FBQztJQUN4QixDQUFDO0lBRUQ7Ozs7Ozs7T0FPRztJQUNPLFlBQVksQ0FDbEIsU0FBaUIsRUFDakIsSUFBWSxFQUFFLFFBQWdCLEVBQzlCLGNBQXVFO1FBRXZFLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDO1FBQ3RCLElBQUksQ0FBQyxTQUFTLEdBQUcsUUFBUSxDQUFDO1FBQzFCLElBQUksQ0FBQyxlQUFlLEdBQUcsSUFBSSxTQUFTLEVBQUUsQ0FBQyxlQUFlLENBQUMsU0FBUyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQzlFLElBQUksY0FBYyxFQUFFO1lBQ2hCLElBQUksQ0FBQyw2QkFBNkIsR0FBRyxJQUFJLFNBQVMsRUFBRSxDQUFDLGVBQWUsQ0FBQyxjQUFjLENBQUMsVUFBVSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1NBQy9HO1FBQ0QsSUFBSSxDQUFDLGdCQUFnQixHQUFHLFNBQVMsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7SUFDckQsQ0FBQztJQW9CUyx3QkFBd0I7UUFDOUIsSUFBSSxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLEVBQUU7WUFDcEMsSUFBSSxDQUFDLG9CQUFvQixFQUFFLENBQUM7WUFDNUIsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1NBQ3ZCO0lBQ0wsQ0FBQztJQUVEOztPQUVHO0lBQ0ksWUFBWTtRQUNmLElBQUksQ0FBQyxnQ0FBZ0MsR0FBRyxDQUFDLENBQUM7UUFDMUMsSUFBSSxDQUFDLCtCQUErQixHQUFHLENBQUMsQ0FBQztRQUN6QyxJQUFJLENBQUMsMkJBQTJCLEdBQUcsQ0FBQyxDQUFDO1FBQ3JDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDLEVBQWMsRUFBRSxFQUFFO1lBQ3JDLElBQUksaUJBQWlCLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRSxFQUFFO2dCQUMxQyxJQUFJLENBQUMsZ0NBQWdDLEVBQUUsQ0FBQzthQUMzQztZQUNELE1BQU0sS0FBSyxHQUFHLEVBQUUsQ0FBQyxXQUFXLEVBQUUsQ0FBQztZQUMvQixJQUFJLGlCQUFpQixDQUFDLEtBQUssQ0FBQyxJQUFJLEtBQUssS0FBSyxTQUFTLEVBQUU7Z0JBQ2pELElBQUksQ0FBQywrQkFBK0IsRUFBRSxDQUFDO2FBQzFDO1lBQ0QsSUFBSSxLQUFLLEtBQUssZ0JBQWdCLEVBQUU7Z0JBQzVCLElBQUksQ0FBQywyQkFBMkIsRUFBRSxDQUFDO2FBQ3RDO1FBQ0wsQ0FBQyxDQUFDLENBQUM7SUFDUCxDQUFDO0lBRU0sUUFBUTtRQUNYLElBQUksQ0FBQyx3QkFBd0IsRUFBRSxDQUFDO1FBQ2hDLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQztJQUMxQixDQUFDO0lBRUQ7O09BRUc7SUFDSSxrQkFBa0I7UUFDckIsSUFBSSxDQUFDLHdCQUF3QixFQUFFLENBQUM7UUFDaEMsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQztJQUNsQyxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsOEJBQThCO1FBQzFCLElBQUksQ0FBQyx3QkFBd0IsRUFBRSxDQUFDO1FBQ2hDLE9BQU8sSUFBSSxDQUFDLCtCQUErQixDQUFDO0lBQ2hELENBQUM7SUFFRDs7T0FFRztJQUNILDBCQUEwQjtRQUN0QixJQUFJLENBQUMsd0JBQXdCLEVBQUUsQ0FBQztRQUNoQyxPQUFPLElBQUksQ0FBQywyQkFBMkIsQ0FBQztJQUM1QyxDQUFDO0lBRUQ7OztPQUdHO0lBQ0ksK0JBQStCO1FBQ2xDLElBQUksQ0FBQyx3QkFBd0IsRUFBRSxDQUFDO1FBQ2hDLE9BQU8sSUFBSSxDQUFDLGdDQUFnQyxDQUFDO0lBQ2pELENBQUM7SUFjRDs7O09BR0c7SUFDSSxnQkFBZ0IsQ0FBQyxRQUEyQztRQUMvRCxJQUFJLENBQUMsd0JBQXdCLEVBQUUsQ0FBQztRQUNoQyxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDbEQsQ0FBQztJQUVEOzs7O09BSUc7SUFDSSxlQUFlLENBQUMsRUFBVTtRQUM3QixJQUFJLENBQUMsd0JBQXdCLEVBQUUsQ0FBQztRQUNoQyxPQUFPLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxLQUFLLEVBQUUsQ0FBQyxDQUFDO0lBQ3RELENBQUM7SUFFRDs7OztPQUlHO0lBQ0ksNkJBQTZCLENBQUMsRUFBVTtRQUMzQyxJQUFJLENBQUMsd0JBQXdCLEVBQUUsQ0FBQztRQUNoQyxJQUFJLElBQUksQ0FBQyx3QkFBd0IsSUFBSSxJQUFJLENBQUMsd0JBQXdCLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtZQUMzRSxPQUFPLElBQUksQ0FBQyx3QkFBd0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7U0FDbkU7UUFDRCxPQUFPLElBQUksQ0FBQztJQUNoQixDQUFDO0lBa0JEOzs7OztPQUtHO0lBQ0ksNEJBQTRCLENBQUMsYUFBcUI7UUFDckQsSUFBSSxDQUFDLGFBQWEsR0FBRyxhQUFhLENBQUM7SUFDdkMsQ0FBQztJQUVEOzs7O09BSUc7SUFDSCw0QkFBNEI7UUFDeEIsT0FBTyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQztJQUMzRSxDQUFDO0lBRUQ7Ozs7O09BS0c7SUFDSSwyQkFBMkIsQ0FBQyxZQUFvQjtRQUNuRCxJQUFJLENBQUMsWUFBWSxHQUFHLFlBQVksQ0FBQztJQUNyQyxDQUFDO0lBRUQ7Ozs7T0FJRztJQUNILDJCQUEyQjtRQUN2QixPQUFPLGlCQUFpQixDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDO0lBQ3pFLENBQUM7SUEyQkQ7OztPQUdHO0lBQ0kscUJBQXFCLENBQUMsRUFBVTtRQUNuQyxNQUFNLE1BQU0sR0FBUyxJQUFJLENBQUMsZUFBZSxDQUFDLGNBQWMsQ0FBQyxFQUFFLENBQUMsQ0FBQztRQUM3RCxJQUFJLE1BQU0sRUFBRTtZQUNSLE1BQU0sQ0FBQyxVQUFVLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ3RDLElBQUksQ0FBQyx3QkFBd0IsRUFBRSxDQUFDO1lBQ2hDLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDLENBQUM7WUFDL0QsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1NBQ3ZCO0lBQ0wsQ0FBQztJQUVEOztPQUVHO0lBQ0ksUUFBUTtRQUNYLE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQztJQUMxQixDQUFDO0lBRUQ7O09BRUc7SUFDSSxRQUFRO1FBQ1gsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDO0lBQzFCLENBQUM7SUFFRDs7Ozs7O09BTUc7SUFDSSxhQUFhLENBQUMsY0FBd0I7UUFDekMsTUFBTSxPQUFPLEdBQXlCLEVBQUUsQ0FBQztRQUN6QyxJQUFJLGNBQWMsS0FBSyxJQUFJLEVBQUU7WUFDekIsT0FBTyxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUM7WUFDeEIsT0FBTyxDQUFDLFlBQVksR0FBRyxJQUFJLENBQUM7WUFDNUIsT0FBTyxDQUFDLG9CQUFvQixHQUFHLElBQUksQ0FBQyx3QkFBd0IsRUFBRSxDQUFDO1NBQ2xFO1FBQ0QsTUFBTSxNQUFNLEdBQUcsSUFBSSxhQUFhLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsZUFBZSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ3BGLElBQUksSUFBSSxDQUFDLGdCQUFnQixFQUFFO1lBQ3ZCLDhDQUE4QztZQUM5QyxPQUFPLE1BQU0sR0FBRyxJQUFJLENBQUM7U0FDeEI7YUFBTTtZQUNILE9BQU8sTUFBTSxDQUFDO1NBQ2pCO0lBQ0wsQ0FBQztDQWtCSiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFNUQVRFX05FVywgU1RBVEVfVFJBTlNMQVRFRCB9IGZyb20gJy4uL2FwaS9jb25zdGFudHMnO1xyXG5pbXBvcnQgeyBJVHJhbnNsYXRpb25NZXNzYWdlc0ZpbGUgfSBmcm9tICcuLi9hcGkvaS10cmFuc2xhdGlvbi1tZXNzYWdlcy1maWxlJztcclxuaW1wb3J0IHsgSU5vcm1hbGl6ZWRNZXNzYWdlIH0gZnJvbSAnLi4vYXBpL2ktbm9ybWFsaXplZC1tZXNzYWdlJztcclxuaW1wb3J0IHsgSVRyYW5zVW5pdCB9IGZyb20gJy4uL2FwaS9pLXRyYW5zLXVuaXQnO1xyXG5pbXBvcnQgeyBpc051bGxPclVuZGVmaW5lZCB9IGZyb20gJ3V0aWwnO1xyXG5pbXBvcnQgeyBET01QYXJzZXIgfSBmcm9tICd4bWxkb20nO1xyXG5pbXBvcnQgeyBYbWxTZXJpYWxpemVyLCBYbWxTZXJpYWxpemVyT3B0aW9ucyB9IGZyb20gJy4veG1sLXNlcmlhbGl6ZXInO1xyXG4vKipcclxuICogQ3JlYXRlZCBieSByb29ibSBvbiAwOS4wNS4yMDE3LlxyXG4gKiBBYnN0cmFjdCBzdXBlcmNsYXNzIGZvciBhbGwgaW1wbGVtZW50YXRpb25zIG9mIElUcmFuc2xhdGlvbk1lc3NhZ2VzRmlsZS5cclxuICovXHJcblxyXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgQWJzdHJhY3RUcmFuc2xhdGlvbk1lc3NhZ2VzRmlsZSBpbXBsZW1lbnRzIElUcmFuc2xhdGlvbk1lc3NhZ2VzRmlsZSB7XHJcblxyXG4gICAgcHJvdGVjdGVkIF9maWxlbmFtZTogc3RyaW5nO1xyXG5cclxuICAgIHByb3RlY3RlZCBfZW5jb2Rpbmc6IHN0cmluZztcclxuXHJcbiAgICBwcm90ZWN0ZWQgX3BhcnNlZERvY3VtZW50OiBEb2N1bWVudDtcclxuXHJcbiAgICBwcm90ZWN0ZWQgX3BhcnNlZE9wdGlvbmFsTWFzdGVyRG9jdW1lbnQ6IERvY3VtZW50O1xyXG5cclxuICAgIHByb3RlY3RlZCBfZmlsZUVuZHNXaXRoRU9MOiBib29sZWFuO1xyXG5cclxuICAgIC8vIHRyYW5zLXVuaXQgZWxlbWVudHMgYW5kIHRoZWlyIGlkIGZyb20gdGhlIGZpbGVcclxuICAgIHByb3RlY3RlZCB0cmFuc1VuaXRzOiBJVHJhbnNVbml0W107XHJcblxyXG4gICAgcHJvdGVjdGVkIG9wdGlvbmFsTWFzdGVyVHJhbnNVbml0czogSVRyYW5zVW5pdFtdO1xyXG5cclxuICAgIHByb3RlY3RlZCBfd2FybmluZ3M6IHN0cmluZ1tdO1xyXG5cclxuICAgIHByb3RlY3RlZCBfbnVtYmVyT2ZUcmFuc1VuaXRzV2l0aE1pc3NpbmdJZDogbnVtYmVyO1xyXG5cclxuICAgIHByb3RlY3RlZCBfbnVtYmVyT2ZVbnRyYW5zbGF0ZWRUcmFuc1VuaXRzOiBudW1iZXI7XHJcblxyXG4gICAgcHJvdGVjdGVkIF9udW1iZXJPZlJldmlld2VkVHJhbnNVbml0czogbnVtYmVyO1xyXG5cclxuICAgIHByb3RlY3RlZCB0YXJnZXRQcmFlZml4OiBzdHJpbmc7XHJcblxyXG4gICAgcHJvdGVjdGVkIHRhcmdldFN1ZmZpeDogc3RyaW5nO1xyXG5cclxuICAgIHByb3RlY3RlZCBjb25zdHJ1Y3RvcigpIHtcclxuICAgICAgICB0aGlzLnRyYW5zVW5pdHMgPSBudWxsO1xyXG4gICAgICAgIHRoaXMuX3dhcm5pbmdzID0gW107XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBQYXJzZSBmaWxlIGNvbnRlbnQuXHJcbiAgICAgKiBTZXRzIF9wYXJzZWREb2N1bWVudCwgbGluZSBlbmRpbmcsIGVuY29kaW5nLCBldGMuXHJcbiAgICAgKiBAcGFyYW0geG1sU3RyaW5nIHhtbFN0cmluZ1xyXG4gICAgICogQHBhcmFtIHBhdGggcGF0aFxyXG4gICAgICogQHBhcmFtIGVuY29kaW5nIGVuY29kaW5nXHJcbiAgICAgKiBAcGFyYW0gb3B0aW9uYWxNYXN0ZXIgb3B0aW9uYWxNYXN0ZXJcclxuICAgICAqL1xyXG4gICAgcHJvdGVjdGVkIHBhcnNlQ29udGVudChcclxuICAgICAgICB4bWxTdHJpbmc6IHN0cmluZyxcclxuICAgICAgICBwYXRoOiBzdHJpbmcsIGVuY29kaW5nOiBzdHJpbmcsXHJcbiAgICAgICAgb3B0aW9uYWxNYXN0ZXI/OiB7IHhtbENvbnRlbnQ6IHN0cmluZywgcGF0aDogc3RyaW5nLCBlbmNvZGluZzogc3RyaW5nIH0pXHJcbiAgICAgICAgOiB2b2lkIHtcclxuICAgICAgICB0aGlzLl9maWxlbmFtZSA9IHBhdGg7XHJcbiAgICAgICAgdGhpcy5fZW5jb2RpbmcgPSBlbmNvZGluZztcclxuICAgICAgICB0aGlzLl9wYXJzZWREb2N1bWVudCA9IG5ldyBET01QYXJzZXIoKS5wYXJzZUZyb21TdHJpbmcoeG1sU3RyaW5nLCAndGV4dC94bWwnKTtcclxuICAgICAgICBpZiAob3B0aW9uYWxNYXN0ZXIpIHtcclxuICAgICAgICAgICAgdGhpcy5fcGFyc2VkT3B0aW9uYWxNYXN0ZXJEb2N1bWVudCA9IG5ldyBET01QYXJzZXIoKS5wYXJzZUZyb21TdHJpbmcob3B0aW9uYWxNYXN0ZXIueG1sQ29udGVudCwgJ3RleHQveG1sJyk7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRoaXMuX2ZpbGVFbmRzV2l0aEVPTCA9IHhtbFN0cmluZy5lbmRzV2l0aCgnXFxuJyk7XHJcbiAgICB9XHJcblxyXG4gICAgYWJzdHJhY3QgaTE4bkZvcm1hdCgpOiBzdHJpbmc7XHJcblxyXG4gICAgYWJzdHJhY3QgZmlsZVR5cGUoKTogc3RyaW5nO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogcmV0dXJuIHRhZyBuYW1lcyBvZiBhbGwgZWxlbWVudHMgdGhhdCBoYXZlIG1peGVkIGNvbnRlbnQuXHJcbiAgICAgKiBUaGVzZSBlbGVtZW50cyB3aWxsIG5vdCBiZSBiZWF1dGlmaWVkLlxyXG4gICAgICogVHlwaWNhbCBjYW5kaWRhdGVzIGFyZSBzb3VyY2UgYW5kIHRhcmdldC5cclxuICAgICAqL1xyXG4gICAgcHJvdGVjdGVkIGFic3RyYWN0IGVsZW1lbnRzV2l0aE1peGVkQ29udGVudCgpOiBzdHJpbmdbXTtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFJlYWQgYWxsIHRyYW5zIHVuaXRzIGZyb20geG1sIGNvbnRlbnQuXHJcbiAgICAgKiBQdXRzIHRoZSBmb3VuZCB1bml0cyBpbnRvIHRyYW5zVW5pdHMuXHJcbiAgICAgKiBQdXRzIHdhcm5pbmdzIGZvciBtaXNzaW5nIGlkcy5cclxuICAgICAqL1xyXG4gICAgcHJvdGVjdGVkIGFic3RyYWN0IGluaXRpYWxpemVUcmFuc1VuaXRzKCk7XHJcblxyXG4gICAgcHJvdGVjdGVkIGxhenlJbml0aWFsaXplVHJhbnNVbml0cygpIHtcclxuICAgICAgICBpZiAoaXNOdWxsT3JVbmRlZmluZWQodGhpcy50cmFuc1VuaXRzKSkge1xyXG4gICAgICAgICAgICB0aGlzLmluaXRpYWxpemVUcmFuc1VuaXRzKCk7XHJcbiAgICAgICAgICAgIHRoaXMuY291bnROdW1iZXJzKCk7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogY291bnQgdW5pdHMgYWZ0ZXIgY2hhbmdlcyBvZiB0cmFucyB1bml0c1xyXG4gICAgICovXHJcbiAgICBwdWJsaWMgY291bnROdW1iZXJzKCkge1xyXG4gICAgICAgIHRoaXMuX251bWJlck9mVHJhbnNVbml0c1dpdGhNaXNzaW5nSWQgPSAwO1xyXG4gICAgICAgIHRoaXMuX251bWJlck9mVW50cmFuc2xhdGVkVHJhbnNVbml0cyA9IDA7XHJcbiAgICAgICAgdGhpcy5fbnVtYmVyT2ZSZXZpZXdlZFRyYW5zVW5pdHMgPSAwO1xyXG4gICAgICAgIHRoaXMuZm9yRWFjaFRyYW5zVW5pdCgodHU6IElUcmFuc1VuaXQpID0+IHtcclxuICAgICAgICAgICAgaWYgKGlzTnVsbE9yVW5kZWZpbmVkKHR1LmlkKSB8fCB0dS5pZCA9PT0gJycpIHtcclxuICAgICAgICAgICAgICAgIHRoaXMuX251bWJlck9mVHJhbnNVbml0c1dpdGhNaXNzaW5nSWQrKztcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBjb25zdCBzdGF0ZSA9IHR1LnRhcmdldFN0YXRlKCk7XHJcbiAgICAgICAgICAgIGlmIChpc051bGxPclVuZGVmaW5lZChzdGF0ZSkgfHwgc3RhdGUgPT09IFNUQVRFX05FVykge1xyXG4gICAgICAgICAgICAgICAgdGhpcy5fbnVtYmVyT2ZVbnRyYW5zbGF0ZWRUcmFuc1VuaXRzKys7XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKHN0YXRlID09PSBTVEFURV9UUkFOU0xBVEVEKSB7XHJcbiAgICAgICAgICAgICAgICB0aGlzLl9udW1iZXJPZlJldmlld2VkVHJhbnNVbml0cysrO1xyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9XHJcblxyXG4gICAgcHVibGljIHdhcm5pbmdzKCk6IHN0cmluZ1tdIHtcclxuICAgICAgICB0aGlzLmxhenlJbml0aWFsaXplVHJhbnNVbml0cygpO1xyXG4gICAgICAgIHJldHVybiB0aGlzLl93YXJuaW5ncztcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIFRvdGFsIG51bWJlciBvZiB0cmFuc2xhdGlvbiB1bml0cyBmb3VuZCBpbiB0aGUgZmlsZS5cclxuICAgICAqL1xyXG4gICAgcHVibGljIG51bWJlck9mVHJhbnNVbml0cygpOiBudW1iZXIge1xyXG4gICAgICAgIHRoaXMubGF6eUluaXRpYWxpemVUcmFuc1VuaXRzKCk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMudHJhbnNVbml0cy5sZW5ndGg7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBOdW1iZXIgb2YgdHJhbnNsYXRpb24gdW5pdHMgd2l0aG91dCB0cmFuc2xhdGlvbiBmb3VuZCBpbiB0aGUgZmlsZS5cclxuICAgICAqIFRoZXNlIHVuaXRzIGhhdmUgc3RhdGUgJ3RyYW5zbGF0ZWQnLlxyXG4gICAgICovXHJcbiAgICBudW1iZXJPZlVudHJhbnNsYXRlZFRyYW5zVW5pdHMoKTogbnVtYmVyIHtcclxuICAgICAgICB0aGlzLmxhenlJbml0aWFsaXplVHJhbnNVbml0cygpO1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9udW1iZXJPZlVudHJhbnNsYXRlZFRyYW5zVW5pdHM7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBOdW1iZXIgb2YgdHJhbnNsYXRpb24gdW5pdHMgd2l0aCBzdGF0ZSAnZmluYWwnLlxyXG4gICAgICovXHJcbiAgICBudW1iZXJPZlJldmlld2VkVHJhbnNVbml0cygpOiBudW1iZXIge1xyXG4gICAgICAgIHRoaXMubGF6eUluaXRpYWxpemVUcmFuc1VuaXRzKCk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMuX251bWJlck9mUmV2aWV3ZWRUcmFuc1VuaXRzO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogTnVtYmVyIG9mIHRyYW5zbGF0aW9uIHVuaXRzIHdpdGhvdXQgdHJhbnNsYXRpb24gZm91bmQgaW4gdGhlIGZpbGUuXHJcbiAgICAgKiBUaGVzZSB1bml0cyBoYXZlIHN0YXRlICd0cmFuc2xhdGVkJy5cclxuICAgICAqL1xyXG4gICAgcHVibGljIG51bWJlck9mVHJhbnNVbml0c1dpdGhNaXNzaW5nSWQoKTogbnVtYmVyIHtcclxuICAgICAgICB0aGlzLmxhenlJbml0aWFsaXplVHJhbnNVbml0cygpO1xyXG4gICAgICAgIHJldHVybiB0aGlzLl9udW1iZXJPZlRyYW5zVW5pdHNXaXRoTWlzc2luZ0lkO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogR2V0IHNvdXJjZSBsYW5ndWFnZS5cclxuICAgICAqIEByZXR1cm4gc291cmNlIGxhbmd1YWdlLlxyXG4gICAgICovXHJcbiAgICBhYnN0cmFjdCBzb3VyY2VMYW5ndWFnZSgpOiBzdHJpbmc7XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBHZXQgdGFyZ2V0IGxhbmd1YWdlLlxyXG4gICAgICogQHJldHVybiB0YXJnZXQgbGFuZ3VhZ2UuXHJcbiAgICAgKi9cclxuICAgIGFic3RyYWN0IHRhcmdldExhbmd1YWdlKCk6IHN0cmluZztcclxuXHJcbiAgICAvKipcclxuICAgICAqIExvb3Agb3ZlciBhbGwgVHJhbnNsYXRpb24gVW5pdHMuXHJcbiAgICAgKiBAcGFyYW0gY2FsbGJhY2sgY2FsbGJhY2tcclxuICAgICAqL1xyXG4gICAgcHVibGljIGZvckVhY2hUcmFuc1VuaXQoY2FsbGJhY2s6ICgodHJhbnN1bml0OiBJVHJhbnNVbml0KSA9PiB2b2lkKSkge1xyXG4gICAgICAgIHRoaXMubGF6eUluaXRpYWxpemVUcmFuc1VuaXRzKCk7XHJcbiAgICAgICAgdGhpcy50cmFuc1VuaXRzLmZvckVhY2goKHR1KSA9PiBjYWxsYmFjayh0dSkpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogR2V0IHRyYW5zLXVuaXQgd2l0aCBnaXZlbiBpZC5cclxuICAgICAqIEBwYXJhbSBpZCBpZFxyXG4gICAgICogQHJldHVybiB0cmFucy11bml0IHdpdGggZ2l2ZW4gaWQuXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyB0cmFuc1VuaXRXaXRoSWQoaWQ6IHN0cmluZyk6IElUcmFuc1VuaXQge1xyXG4gICAgICAgIHRoaXMubGF6eUluaXRpYWxpemVUcmFuc1VuaXRzKCk7XHJcbiAgICAgICAgcmV0dXJuIHRoaXMudHJhbnNVbml0cy5maW5kKCh0dSkgPT4gdHUuaWQgPT09IGlkKTtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEdldCBvcHRpb25hbCB0cmFucy11bml0IHdpdGggZ2l2ZW4gaWQuXHJcbiAgICAgKiBAcGFyYW0gaWQgaWRcclxuICAgICAqIEByZXR1cm4gdHJhbnMtdW5pdCB3aXRoIGdpdmVuIGlkLlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgb3B0aW9uYWxNYXN0ZXJUcmFuc1VuaXRXaXRoSWQoaWQ6IHN0cmluZyk6IElUcmFuc1VuaXQge1xyXG4gICAgICAgIHRoaXMubGF6eUluaXRpYWxpemVUcmFuc1VuaXRzKCk7XHJcbiAgICAgICAgaWYgKHRoaXMub3B0aW9uYWxNYXN0ZXJUcmFuc1VuaXRzICYmIHRoaXMub3B0aW9uYWxNYXN0ZXJUcmFuc1VuaXRzLmxlbmd0aCA+IDApIHtcclxuICAgICAgICAgICAgcmV0dXJuIHRoaXMub3B0aW9uYWxNYXN0ZXJUcmFuc1VuaXRzLmZpbmQoKHR1KSA9PiB0dS5pZCA9PT0gaWQpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gbnVsbDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEVkaXQgZnVuY3Rpb25zIGZvbGxvd2luZyBoZXJcclxuICAgICAqL1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogRWRpdCB0aGUgc291cmNlIGxhbmd1YWdlLlxyXG4gICAgICogQHBhcmFtIGxhbmd1YWdlIGxhbmd1YWdlXHJcbiAgICAgKi9cclxuICAgIGFic3RyYWN0IHNldFNvdXJjZUxhbmd1YWdlKGxhbmd1YWdlOiBzdHJpbmcpO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogRWRpdCB0aGUgdGFyZ2V0IGxhbmd1YWdlLlxyXG4gICAgICogQHBhcmFtIGxhbmd1YWdlIGxhbmd1YWdlXHJcbiAgICAgKi9cclxuICAgIGFic3RyYWN0IHNldFRhcmdldExhbmd1YWdlKGxhbmd1YWdlOiBzdHJpbmcpO1xyXG5cclxuICAgIC8qKlxyXG4gICAgICogU2V0IHRoZSBwcmFlZml4IHVzZWQgd2hlbiBjb3B5aW5nIHNvdXJjZSB0byB0YXJnZXQuXHJcbiAgICAgKiBUaGlzIGlzIHVzZWQgYnkgaW1wb3J0TmV3VHJhbnNVbml0IGFuZCBjcmVhdGVUcmFuc2xhdGlvbkZpbGVGb3JMYW5nIG1ldGhvZHMuXHJcbiAgICAgKiAoc2luY2UgMS44LjApXHJcbiAgICAgKiBAcGFyYW0gdGFyZ2V0UHJhZWZpeCB0YXJnZXRQcmFlZml4XHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBzZXROZXdUcmFuc1VuaXRUYXJnZXRQcmFlZml4KHRhcmdldFByYWVmaXg6IHN0cmluZykge1xyXG4gICAgICAgIHRoaXMudGFyZ2V0UHJhZWZpeCA9IHRhcmdldFByYWVmaXg7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBHZXQgdGhlIHByYWVmaXggdXNlZCB3aGVuIGNvcHlpbmcgc291cmNlIHRvIHRhcmdldC5cclxuICAgICAqIChzaW5jZSAxLjguMClcclxuICAgICAqIEByZXR1cm4gdGhlIHByYWVmaXggdXNlZCB3aGVuIGNvcHlpbmcgc291cmNlIHRvIHRhcmdldC5cclxuICAgICAqL1xyXG4gICAgZ2V0TmV3VHJhbnNVbml0VGFyZ2V0UHJhZWZpeCgpOiBzdHJpbmcge1xyXG4gICAgICAgIHJldHVybiBpc051bGxPclVuZGVmaW5lZCh0aGlzLnRhcmdldFByYWVmaXgpID8gJycgOiB0aGlzLnRhcmdldFByYWVmaXg7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBTZXQgdGhlIHN1ZmZpeCB1c2VkIHdoZW4gY29weWluZyBzb3VyY2UgdG8gdGFyZ2V0LlxyXG4gICAgICogVGhpcyBpcyB1c2VkIGJ5IGltcG9ydE5ld1RyYW5zVW5pdCBhbmQgY3JlYXRlVHJhbnNsYXRpb25GaWxlRm9yTGFuZyBtZXRob2RzLlxyXG4gICAgICogKHNpbmNlIDEuOC4wKVxyXG4gICAgICogQHBhcmFtIHRhcmdldFN1ZmZpeCB0YXJnZXRTdWZmaXhcclxuICAgICAqL1xyXG4gICAgcHVibGljIHNldE5ld1RyYW5zVW5pdFRhcmdldFN1ZmZpeCh0YXJnZXRTdWZmaXg6IHN0cmluZykge1xyXG4gICAgICAgIHRoaXMudGFyZ2V0U3VmZml4ID0gdGFyZ2V0U3VmZml4O1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogR2V0IHRoZSBzdWZmaXggdXNlZCB3aGVuIGNvcHlpbmcgc291cmNlIHRvIHRhcmdldC5cclxuICAgICAqIChzaW5jZSAxLjguMClcclxuICAgICAqIEByZXR1cm4gdGhlIHN1ZmZpeCB1c2VkIHdoZW4gY29weWluZyBzb3VyY2UgdG8gdGFyZ2V0LlxyXG4gICAgICovXHJcbiAgICBnZXROZXdUcmFuc1VuaXRUYXJnZXRTdWZmaXgoKTogc3RyaW5nIHtcclxuICAgICAgICByZXR1cm4gaXNOdWxsT3JVbmRlZmluZWQodGhpcy50YXJnZXRTdWZmaXgpID8gJycgOiB0aGlzLnRhcmdldFN1ZmZpeDtcclxuICAgIH1cclxuXHJcbiAgICAvKipcclxuICAgICAqIEFkZCBhIG5ldyB0cmFucy11bml0IHRvIHRoaXMgZmlsZS5cclxuICAgICAqIFRoZSB0cmFucyB1bml0IHN0ZW1zIGZyb20gYW5vdGhlciBmaWxlLlxyXG4gICAgICogSXQgY29waWVzIHRoZSBzb3VyY2UgY29udGVudCBvZiB0aGUgdHUgdG8gdGhlIHRhcmdldCBjb250ZW50IHRvbyxcclxuICAgICAqIGRlcGVuZGluZyBvbiB0aGUgdmFsdWVzIG9mIGlzRGVmYXVsdExhbmcgYW5kIGNvcHlDb250ZW50LlxyXG4gICAgICogU28gdGhlIHNvdXJjZSBjYW4gYmUgdXNlZCBhcyBhIGR1bW15IHRyYW5zbGF0aW9uLlxyXG4gICAgICogKHVzZWQgYnkgeGxpZmZtZXJnZSlcclxuICAgICAqIEBwYXJhbSBmb3JlaWduVHJhbnNVbml0IHRoZSB0cmFucyB1bml0IHRvIGJlIGltcG9ydGVkLlxyXG4gICAgICogQHBhcmFtIGlzRGVmYXVsdExhbmcgRmxhZywgd2V0aGVyIGZpbGUgY29udGFpbnMgdGhlIGRlZmF1bHQgbGFuZ3VhZ2UuXHJcbiAgICAgKiBUaGVuIHNvdXJjZSBhbmQgdGFyZ2V0IGFyZSBqdXN0IGVxdWFsLlxyXG4gICAgICogVGhlIGNvbnRlbnQgd2lsbCBiZSBjb3BpZWQuXHJcbiAgICAgKiBTdGF0ZSB3aWxsIGJlIGZpbmFsLlxyXG4gICAgICogQHBhcmFtIGNvcHlDb250ZW50IEZsYWcsIHdldGhlciB0byBjb3B5IGNvbnRlbnQgb3IgbGVhdmUgaXQgZW1wdHkuXHJcbiAgICAgKiBXYmVuIHRydWUsIGNvbnRlbnQgd2lsbCBiZSBjb3BpZWQgZnJvbSBzb3VyY2UuXHJcbiAgICAgKiBXaGVuIGZhbHNlLCBjb250ZW50IHdpbGwgYmUgbGVmdCBlbXB0eSAoaWYgaXQgaXMgbm90IHRoZSBkZWZhdWx0IGxhbmd1YWdlKS5cclxuICAgICAqIEBwYXJhbSBpbXBvcnRBZnRlckVsZW1lbnQgb3B0aW9uYWwgKHNpbmNlIDEuMTApIG90aGVyIHRyYW5zdW5pdCAocGFydCBvZiB0aGlzIGZpbGUpLCB0aGF0IHNob3VsZCBiZSB1c2VkIGFzIGFuY2VzdG9yLlxyXG4gICAgICogTmV3bHkgaW1wb3J0ZWQgdHJhbnMgdW5pdCBpcyB0aGVuIGluc2VydGVkIGRpcmVjdGx5IGFmdGVyIHRoaXMgZWxlbWVudC5cclxuICAgICAqIElmIG5vdCBzZXQgb3Igbm90IHBhcnQgb2YgdGhpcyBmaWxlLCBuZXcgdW5pdCB3aWxsIGJlIGltcG9ydGVkIGF0IHRoZSBlbmQuXHJcbiAgICAgKiBJZiBleHBsaWNpdHkgc2V0IHRvIG51bGwsIG5ldyB1bml0IHdpbGwgYmUgaW1wb3J0ZWQgYXQgdGhlIHN0YXJ0LlxyXG4gICAgICogQHJldHVybiB0aGUgbmV3bHkgaW1wb3J0ZWQgdHJhbnMgdW5pdCAoc2luY2UgdmVyc2lvbiAxLjcuMClcclxuICAgICAqIEB0aHJvd3MgYW4gZXJyb3IgaWYgdHJhbnMtdW5pdCB3aXRoIHNhbWUgaWQgYWxyZWFkeSBpcyBpbiB0aGUgZmlsZS5cclxuICAgICAqL1xyXG4gICAgYWJzdHJhY3QgaW1wb3J0TmV3VHJhbnNVbml0KGZvcmVpZ25UcmFuc1VuaXQ6IElUcmFuc1VuaXQsIGlzRGVmYXVsdExhbmc6IGJvb2xlYW4sIGNvcHlDb250ZW50OiBib29sZWFuLCBpbXBvcnRBZnRlckVsZW1lbnQ/OiBJVHJhbnNVbml0KVxyXG4gICAgICAgIDogSVRyYW5zVW5pdDtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFJlbW92ZSB0aGUgdHJhbnMtdW5pdCB3aXRoIHRoZSBnaXZlbiBpZC5cclxuICAgICAqIEBwYXJhbSBpZCBpZFxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgcmVtb3ZlVHJhbnNVbml0V2l0aElkKGlkOiBzdHJpbmcpIHtcclxuICAgICAgICBjb25zdCB0dU5vZGU6IE5vZGUgPSB0aGlzLl9wYXJzZWREb2N1bWVudC5nZXRFbGVtZW50QnlJZChpZCk7XHJcbiAgICAgICAgaWYgKHR1Tm9kZSkge1xyXG4gICAgICAgICAgICB0dU5vZGUucGFyZW50Tm9kZS5yZW1vdmVDaGlsZCh0dU5vZGUpO1xyXG4gICAgICAgICAgICB0aGlzLmxhenlJbml0aWFsaXplVHJhbnNVbml0cygpO1xyXG4gICAgICAgICAgICB0aGlzLnRyYW5zVW5pdHMgPSB0aGlzLnRyYW5zVW5pdHMuZmlsdGVyKCh0dSkgPT4gdHUuaWQgIT09IGlkKTtcclxuICAgICAgICAgICAgdGhpcy5jb3VudE51bWJlcnMoKTtcclxuICAgICAgICB9XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUaGUgZmlsZW5hbWUgd2hlcmUgdGhlIGRhdGEgaXMgcmVhZCBmcm9tLlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgZmlsZW5hbWUoKTogc3RyaW5nIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fZmlsZW5hbWU7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUaGUgZW5jb2RpbmcgaWYgdGhlIHhtbCBjb250ZW50IChVVEYtOCwgSVNPLTg4NTktMSwgLi4uKVxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgZW5jb2RpbmcoKTogc3RyaW5nIHtcclxuICAgICAgICByZXR1cm4gdGhpcy5fZW5jb2Rpbmc7XHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBUaGUgeG1sIGNvbnRlbnQgdG8gYmUgc2F2ZWQgYWZ0ZXIgY2hhbmdlcyBhcmUgbWFkZS5cclxuICAgICAqIEBwYXJhbSBiZWF1dGlmeU91dHB1dCBGbGFnIHdoZXRoZXIgdG8gdXNlIHByZXR0eS1kYXRhIHRvIGZvcm1hdCB0aGUgb3V0cHV0LlxyXG4gICAgICogWE1MU2VyaWFsaXplciBwcm9kdWNlcyBzb21lIGNvcnJlY3QgYnV0IHN0cmFuZ2VseSBmb3JtYXR0ZWQgb3V0cHV0LCB3aGljaCBwcmV0dHktZGF0YSBjYW4gY29ycmVjdC5cclxuICAgICAqIFNlZSBpc3N1ZSAjNjQgZm9yIGRldGFpbHMuXHJcbiAgICAgKiBEZWZhdWx0IGlzIGZhbHNlLlxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgZWRpdGVkQ29udGVudChiZWF1dGlmeU91dHB1dD86IGJvb2xlYW4pOiBzdHJpbmcge1xyXG4gICAgICAgIGNvbnN0IG9wdGlvbnM6IFhtbFNlcmlhbGl6ZXJPcHRpb25zID0ge307XHJcbiAgICAgICAgaWYgKGJlYXV0aWZ5T3V0cHV0ID09PSB0cnVlKSB7XHJcbiAgICAgICAgICAgIG9wdGlvbnMuYmVhdXRpZnkgPSB0cnVlO1xyXG4gICAgICAgICAgICBvcHRpb25zLmluZGVudFN0cmluZyA9ICcgICc7XHJcbiAgICAgICAgICAgIG9wdGlvbnMubWl4ZWRDb250ZW50RWxlbWVudHMgPSB0aGlzLmVsZW1lbnRzV2l0aE1peGVkQ29udGVudCgpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBjb25zdCByZXN1bHQgPSBuZXcgWG1sU2VyaWFsaXplcigpLnNlcmlhbGl6ZVRvU3RyaW5nKHRoaXMuX3BhcnNlZERvY3VtZW50LCBvcHRpb25zKTtcclxuICAgICAgICBpZiAodGhpcy5fZmlsZUVuZHNXaXRoRU9MKSB7XHJcbiAgICAgICAgICAgIC8vIGFkZCBlb2wgaWYgdGhlcmUgd2FzIGVvbCBpbiBvcmlnaW5hbCBzb3VyY2VcclxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdCArICdcXG4nO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XHJcbiAgICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogQ3JlYXRlIGEgbmV3IHRyYW5zbGF0aW9uIGZpbGUgZm9yIHRoaXMgZmlsZSBmb3IgYSBnaXZlbiBsYW5ndWFnZS5cclxuICAgICAqIE5vcm1hbGx5LCB0aGlzIGlzIGp1c3QgYSBjb3B5IG9mIHRoZSBvcmlnaW5hbCBvbmUuXHJcbiAgICAgKiBCdXQgZm9yIFhNQiB0aGUgdHJhbnNsYXRpb24gZmlsZSBoYXMgZm9ybWF0ICdYVEInLlxyXG4gICAgICogQHBhcmFtIGxhbmcgTGFuZ3VhZ2UgY29kZVxyXG4gICAgICogQHBhcmFtIGZpbGVuYW1lIGV4cGVjdGVkIGZpbGVuYW1lIHRvIHN0b3JlIGZpbGVcclxuICAgICAqIEBwYXJhbSBpc0RlZmF1bHRMYW5nIEZsYWcsIHdldGhlciBmaWxlIGNvbnRhaW5zIHRoZSBkZWZhdWx0IGxhbmd1YWdlLlxyXG4gICAgICogVGhlbiBzb3VyY2UgYW5kIHRhcmdldCBhcmUganVzdCBlcXVhbC5cclxuICAgICAqIFRoZSBjb250ZW50IHdpbGwgYmUgY29waWVkLlxyXG4gICAgICogU3RhdGUgd2lsbCBiZSBmaW5hbC5cclxuICAgICAqIEBwYXJhbSBjb3B5Q29udGVudCBGbGFnLCB3ZXRoZXIgdG8gY29weSBjb250ZW50IG9yIGxlYXZlIGl0IGVtcHR5LlxyXG4gICAgICogV2JlbiB0cnVlLCBjb250ZW50IHdpbGwgYmUgY29waWVkIGZyb20gc291cmNlLlxyXG4gICAgICogV2hlbiBmYWxzZSwgY29udGVudCB3aWxsIGJlIGxlZnQgZW1wdHkgKGlmIGl0IGlzIG5vdCB0aGUgZGVmYXVsdCBsYW5ndWFnZSkuXHJcbiAgICAgKi9cclxuICAgIGFic3RyYWN0IGNyZWF0ZVRyYW5zbGF0aW9uRmlsZUZvckxhbmcobGFuZzogc3RyaW5nLCBmaWxlbmFtZTogc3RyaW5nLCBpc0RlZmF1bHRMYW5nOiBib29sZWFuLCBjb3B5Q29udGVudDogYm9vbGVhbiwgb3B0aW9uYWxNYXN0ZXI/OiB7IHhtbENvbnRlbnQ6IHN0cmluZywgcGF0aDogc3RyaW5nLCBlbmNvZGluZzogc3RyaW5nIH0pXHJcbiAgICAgICAgOiBJVHJhbnNsYXRpb25NZXNzYWdlc0ZpbGU7XHJcbn1cclxuIl19