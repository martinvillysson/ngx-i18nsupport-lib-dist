import { XliffFile } from '../impl/xliff-file';
import { XmbFile } from '../impl/xmb-file';
import { format } from 'util';
import { Xliff2File } from '../impl/xliff2-file';
import { FORMAT_XLIFF12, FORMAT_XLIFF20, FORMAT_XMB, FORMAT_XTB } from './constants';
import { XtbFile } from '../impl/xtb-file';
/**
 * Helper class to read translation files depending on format.
 * This is part of the public api
 */
export class TranslationMessagesFileFactory {
    /**
     * Read file function, result depends on format, either XliffFile or XmbFile.
     * @param i18nFormat currently 'xlf' or 'xlf2' or 'xmb' or 'xtb' are supported
     * @param xmlContent the file content
     * @param path the path of the file (only used to remember it)
     * @param encoding utf-8, ... used to parse XML.
     * This is read from the file, but if you know it before, you can avoid reading the file twice.
     * @param optionalMaster in case of xmb the master file, that contains the original texts.
     * (this is used to support state infos, that are based on comparing original with translated version)
     * Ignored for other formats.
     * @return either XliffFile or XmbFile
     */
    static fromFileContent(i18nFormat, xmlContent, path, encoding, optionalMaster) {
        return new TranslationMessagesFileFactory().createFileFromFileContent(i18nFormat, xmlContent, path, encoding, optionalMaster);
    }
    /**
     * Read file function for any file with unknown format.
     * This functions tries to guess the format based on the filename and the content of the file.
     * Result depends on detected format, either XliffFile or XmbFile.
     * @param xmlContent the file content
     * @param path the path of the file (only used to remember it)
     * @param encoding utf-8, ... used to parse XML.
     * This is read from the file, but if you know it before, you can avoid reading the file twice.
     * @param optionalMaster in case of xmb the master file, that contains the original texts.
     * (this is used to support state infos, that are based on comparing original with translated version)
     * Ignored for other formats.
     * @return either XliffFile or XmbFile
     */
    static fromUnknownFormatFileContent(xmlContent, path, encoding, optionalMaster) {
        return new TranslationMessagesFileFactory().createFileFromUnknownFormatFileContent(xmlContent, path, encoding, optionalMaster);
    }
    /**
     * Read file function, result depends on format, either XliffFile or XmbFile.
     * @param i18nFormat currently 'xlf' or 'xlf2' or 'xmb' or 'xtb' are supported
     * @param xmlContent the file content
     * @param path the path of the file (only used to remember it)
     * @param encoding utf-8, ... used to parse XML.
     * This is read from the file, but if you know it before, you can avoid reading the file twice.
     * @param optionalMaster in case of xmb the master file, that contains the original texts.
     * (this is used to support state infos, that are based on comparing original with translated version)
     * Ignored for other formats.
     * @return either XliffFile or XmbFile
     */
    createFileFromFileContent(i18nFormat, xmlContent, path, encoding, optionalMaster) {
        if (i18nFormat === FORMAT_XLIFF12) {
            return new XliffFile(xmlContent, path, encoding, optionalMaster);
        }
        if (i18nFormat === FORMAT_XLIFF20) {
            return new Xliff2File(xmlContent, path, encoding);
        }
        if (i18nFormat === FORMAT_XMB) {
            return new XmbFile(this, xmlContent, path, encoding);
        }
        if (i18nFormat === FORMAT_XTB) {
            return new XtbFile(this, xmlContent, path, encoding, optionalMaster);
        }
        throw new Error(format('oops, unsupported format "%s"', i18nFormat));
    }
    /**
     * Read file function for any file with unknown format.
     * This functions tries to guess the format based on the filename and the content of the file.
     * Result depends on detected format, either XliffFile or XmbFile.
     * @param xmlContent the file content
     * @param path the path of the file (only used to remember it)
     * @param encoding utf-8, ... used to parse XML.
     * This is read from the file, but if you know it before, you can avoid reading the file twice.
     * @param optionalMaster in case of xmb the master file, that contains the original texts.
     * (this is used to support state infos, that are based on comparing original with translated version)
     * Ignored for other formats.
     * @return either XliffFile or XmbFile
     */
    createFileFromUnknownFormatFileContent(xmlContent, path, encoding, optionalMaster) {
        let formatCandidates = [FORMAT_XLIFF12, FORMAT_XLIFF20, FORMAT_XMB, FORMAT_XTB];
        if (path && path.endsWith('xmb')) {
            formatCandidates = [FORMAT_XMB, FORMAT_XTB, FORMAT_XLIFF12, FORMAT_XLIFF20];
        }
        if (path && path.endsWith('xtb')) {
            formatCandidates = [FORMAT_XTB, FORMAT_XMB, FORMAT_XLIFF12, FORMAT_XLIFF20];
        }
        // try all candidate formats to get the right one
        for (let i = 0; i < formatCandidates.length; i++) {
            const formatCandidate = formatCandidates[i];
            try {
                const translationFile = TranslationMessagesFileFactory.fromFileContent(formatCandidate, xmlContent, path, encoding, optionalMaster);
                if (translationFile) {
                    return translationFile;
                }
            }
            catch (e) {
                // seams to be the wrong format
            }
        }
        throw new Error(format('could not identify file format, it is neiter XLIFF (1.2 or 2.0) nor XMB/XTB'));
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhbnNsYXRpb24tbWVzc2FnZXMtZmlsZS1mYWN0b3J5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vcHJvamVjdHMvbmd4LWkxOG5zdXBwb3J0LWxpYi9zcmMvYXBpL3RyYW5zbGF0aW9uLW1lc3NhZ2VzLWZpbGUtZmFjdG9yeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFJQSxPQUFPLEVBQUMsU0FBUyxFQUFDLE1BQU0sb0JBQW9CLENBQUM7QUFDN0MsT0FBTyxFQUFDLE9BQU8sRUFBQyxNQUFNLGtCQUFrQixDQUFDO0FBQ3pDLE9BQU8sRUFBQyxNQUFNLEVBQUMsTUFBTSxNQUFNLENBQUM7QUFDNUIsT0FBTyxFQUFDLFVBQVUsRUFBQyxNQUFNLHFCQUFxQixDQUFDO0FBQy9DLE9BQU8sRUFBQyxjQUFjLEVBQUUsY0FBYyxFQUFFLFVBQVUsRUFBRSxVQUFVLEVBQUMsTUFBTSxhQUFhLENBQUM7QUFDbkYsT0FBTyxFQUFDLE9BQU8sRUFBQyxNQUFNLGtCQUFrQixDQUFDO0FBR3pDOzs7R0FHRztBQUNILE1BQU0sT0FBTyw4QkFBOEI7SUFFdkM7Ozs7Ozs7Ozs7O09BV0c7SUFDSSxNQUFNLENBQUMsZUFBZSxDQUFDLFVBQWtCLEVBQ2xCLFVBQWtCLEVBQ2xCLElBQVksRUFDWixRQUFnQixFQUNoQixjQUFxRTtRQUMvRixPQUFPLElBQUksOEJBQThCLEVBQUUsQ0FBQyx5QkFBeUIsQ0FBQyxVQUFVLEVBQUUsVUFBVSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsY0FBYyxDQUFDLENBQUM7SUFDbEksQ0FBQztJQUVEOzs7Ozs7Ozs7Ozs7T0FZRztJQUNJLE1BQU0sQ0FBQyw0QkFBNEIsQ0FBQyxVQUFrQixFQUMvQixJQUFZLEVBQ1osUUFBZ0IsRUFDaEIsY0FBcUU7UUFDL0YsT0FBTyxJQUFJLDhCQUE4QixFQUFFLENBQUMsc0NBQXNDLENBQUMsVUFBVSxFQUFFLElBQUksRUFBRSxRQUFRLEVBQUUsY0FBYyxDQUFDLENBQUM7SUFDbkksQ0FBQztJQUVEOzs7Ozs7Ozs7OztPQVdHO0lBQ0gseUJBQXlCLENBQUMsVUFBa0IsRUFDbEIsVUFBa0IsRUFDbEIsSUFBWSxFQUNaLFFBQWdCLEVBQ2hCLGNBQXVFO1FBQzdGLElBQUksVUFBVSxLQUFLLGNBQWMsRUFBRTtZQUMvQixPQUFPLElBQUksU0FBUyxDQUFDLFVBQVUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLGNBQWMsQ0FBQyxDQUFDO1NBQ3BFO1FBQ0QsSUFBSSxVQUFVLEtBQUssY0FBYyxFQUFFO1lBQy9CLE9BQU8sSUFBSSxVQUFVLENBQUMsVUFBVSxFQUFFLElBQUksRUFBRSxRQUFRLENBQUMsQ0FBQztTQUNyRDtRQUNELElBQUksVUFBVSxLQUFLLFVBQVUsRUFBRTtZQUMzQixPQUFPLElBQUksT0FBTyxDQUFDLElBQUksRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1NBQ3hEO1FBQ0QsSUFBSSxVQUFVLEtBQUssVUFBVSxFQUFFO1lBQzNCLE9BQU8sSUFBSSxPQUFPLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLGNBQWMsQ0FBQyxDQUFDO1NBQ3hFO1FBQ0QsTUFBTSxJQUFJLEtBQUssQ0FBQyxNQUFNLENBQUMsK0JBQStCLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQztJQUV6RSxDQUFDO0lBRUQ7Ozs7Ozs7Ozs7OztPQVlHO0lBQ0gsc0NBQXNDLENBQUMsVUFBa0IsRUFDbEIsSUFBWSxFQUNaLFFBQWdCLEVBQ2hCLGNBQXVFO1FBRTFHLElBQUksZ0JBQWdCLEdBQUcsQ0FBQyxjQUFjLEVBQUUsY0FBYyxFQUFFLFVBQVUsRUFBRSxVQUFVLENBQUMsQ0FBQztRQUNoRixJQUFJLElBQUksSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxFQUFFO1lBQzlCLGdCQUFnQixHQUFHLENBQUMsVUFBVSxFQUFFLFVBQVUsRUFBRSxjQUFjLEVBQUUsY0FBYyxDQUFDLENBQUM7U0FDL0U7UUFDRCxJQUFJLElBQUksSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxFQUFFO1lBQzlCLGdCQUFnQixHQUFHLENBQUMsVUFBVSxFQUFFLFVBQVUsRUFBRSxjQUFjLEVBQUUsY0FBYyxDQUFDLENBQUM7U0FDL0U7UUFDRCxpREFBaUQ7UUFDakQsS0FBSyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLGdCQUFnQixDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtZQUM5QyxNQUFNLGVBQWUsR0FBRyxnQkFBZ0IsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUM1QyxJQUFJO2dCQUNBLE1BQU0sZUFBZSxHQUFHLDhCQUE4QixDQUFDLGVBQWUsQ0FDbEUsZUFBZSxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUUsUUFBUSxFQUFFLGNBQWMsQ0FBQyxDQUFDO2dCQUNqRSxJQUFJLGVBQWUsRUFBRTtvQkFDakIsT0FBTyxlQUFlLENBQUM7aUJBQzFCO2FBQ0o7WUFBQyxPQUFPLENBQUMsRUFBRTtnQkFDUiwrQkFBK0I7YUFDbEM7U0FDSjtRQUNELE1BQU0sSUFBSSxLQUFLLENBQUMsTUFBTSxDQUFDLDZFQUE2RSxDQUFDLENBQUMsQ0FBQztJQUMzRyxDQUFDO0NBRUoiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogQ3JlYXRlZCBieSByb29ibSBvbiAyMS4wMy4yMDE3LlxyXG4gKi9cclxuaW1wb3J0IHtJVHJhbnNsYXRpb25NZXNzYWdlc0ZpbGV9IGZyb20gJy4vaS10cmFuc2xhdGlvbi1tZXNzYWdlcy1maWxlJztcclxuaW1wb3J0IHtYbGlmZkZpbGV9IGZyb20gJy4uL2ltcGwveGxpZmYtZmlsZSc7XHJcbmltcG9ydCB7WG1iRmlsZX0gZnJvbSAnLi4vaW1wbC94bWItZmlsZSc7XHJcbmltcG9ydCB7Zm9ybWF0fSBmcm9tICd1dGlsJztcclxuaW1wb3J0IHtYbGlmZjJGaWxlfSBmcm9tICcuLi9pbXBsL3hsaWZmMi1maWxlJztcclxuaW1wb3J0IHtGT1JNQVRfWExJRkYxMiwgRk9STUFUX1hMSUZGMjAsIEZPUk1BVF9YTUIsIEZPUk1BVF9YVEJ9IGZyb20gJy4vY29uc3RhbnRzJztcclxuaW1wb3J0IHtYdGJGaWxlfSBmcm9tICcuLi9pbXBsL3h0Yi1maWxlJztcclxuaW1wb3J0IHtJVHJhbnNsYXRpb25NZXNzYWdlc0ZpbGVGYWN0b3J5fSBmcm9tICcuL2ktdHJhbnNsYXRpb24tbWVzc2FnZXMtZmlsZS1mYWN0b3J5JztcclxuXHJcbi8qKlxyXG4gKiBIZWxwZXIgY2xhc3MgdG8gcmVhZCB0cmFuc2xhdGlvbiBmaWxlcyBkZXBlbmRpbmcgb24gZm9ybWF0LlxyXG4gKiBUaGlzIGlzIHBhcnQgb2YgdGhlIHB1YmxpYyBhcGlcclxuICovXHJcbmV4cG9ydCBjbGFzcyBUcmFuc2xhdGlvbk1lc3NhZ2VzRmlsZUZhY3RvcnkgaW1wbGVtZW50cyBJVHJhbnNsYXRpb25NZXNzYWdlc0ZpbGVGYWN0b3J5IHtcclxuXHJcbiAgICAvKipcclxuICAgICAqIFJlYWQgZmlsZSBmdW5jdGlvbiwgcmVzdWx0IGRlcGVuZHMgb24gZm9ybWF0LCBlaXRoZXIgWGxpZmZGaWxlIG9yIFhtYkZpbGUuXHJcbiAgICAgKiBAcGFyYW0gaTE4bkZvcm1hdCBjdXJyZW50bHkgJ3hsZicgb3IgJ3hsZjInIG9yICd4bWInIG9yICd4dGInIGFyZSBzdXBwb3J0ZWRcclxuICAgICAqIEBwYXJhbSB4bWxDb250ZW50IHRoZSBmaWxlIGNvbnRlbnRcclxuICAgICAqIEBwYXJhbSBwYXRoIHRoZSBwYXRoIG9mIHRoZSBmaWxlIChvbmx5IHVzZWQgdG8gcmVtZW1iZXIgaXQpXHJcbiAgICAgKiBAcGFyYW0gZW5jb2RpbmcgdXRmLTgsIC4uLiB1c2VkIHRvIHBhcnNlIFhNTC5cclxuICAgICAqIFRoaXMgaXMgcmVhZCBmcm9tIHRoZSBmaWxlLCBidXQgaWYgeW91IGtub3cgaXQgYmVmb3JlLCB5b3UgY2FuIGF2b2lkIHJlYWRpbmcgdGhlIGZpbGUgdHdpY2UuXHJcbiAgICAgKiBAcGFyYW0gb3B0aW9uYWxNYXN0ZXIgaW4gY2FzZSBvZiB4bWIgdGhlIG1hc3RlciBmaWxlLCB0aGF0IGNvbnRhaW5zIHRoZSBvcmlnaW5hbCB0ZXh0cy5cclxuICAgICAqICh0aGlzIGlzIHVzZWQgdG8gc3VwcG9ydCBzdGF0ZSBpbmZvcywgdGhhdCBhcmUgYmFzZWQgb24gY29tcGFyaW5nIG9yaWdpbmFsIHdpdGggdHJhbnNsYXRlZCB2ZXJzaW9uKVxyXG4gICAgICogSWdub3JlZCBmb3Igb3RoZXIgZm9ybWF0cy5cclxuICAgICAqIEByZXR1cm4gZWl0aGVyIFhsaWZmRmlsZSBvciBYbWJGaWxlXHJcbiAgICAgKi9cclxuICAgIHB1YmxpYyBzdGF0aWMgZnJvbUZpbGVDb250ZW50KGkxOG5Gb3JtYXQ6IHN0cmluZyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHhtbENvbnRlbnQ6IHN0cmluZyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhdGg6IHN0cmluZyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVuY29kaW5nOiBzdHJpbmcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25hbE1hc3Rlcj86IHt4bWxDb250ZW50OiBzdHJpbmcsIHBhdGg6IHN0cmluZywgZW5jb2Rpbmc6IHN0cmluZ30pOiBJVHJhbnNsYXRpb25NZXNzYWdlc0ZpbGUge1xyXG4gICAgICAgIHJldHVybiBuZXcgVHJhbnNsYXRpb25NZXNzYWdlc0ZpbGVGYWN0b3J5KCkuY3JlYXRlRmlsZUZyb21GaWxlQ29udGVudChpMThuRm9ybWF0LCB4bWxDb250ZW50LCBwYXRoLCBlbmNvZGluZywgb3B0aW9uYWxNYXN0ZXIpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmVhZCBmaWxlIGZ1bmN0aW9uIGZvciBhbnkgZmlsZSB3aXRoIHVua25vd24gZm9ybWF0LlxyXG4gICAgICogVGhpcyBmdW5jdGlvbnMgdHJpZXMgdG8gZ3Vlc3MgdGhlIGZvcm1hdCBiYXNlZCBvbiB0aGUgZmlsZW5hbWUgYW5kIHRoZSBjb250ZW50IG9mIHRoZSBmaWxlLlxyXG4gICAgICogUmVzdWx0IGRlcGVuZHMgb24gZGV0ZWN0ZWQgZm9ybWF0LCBlaXRoZXIgWGxpZmZGaWxlIG9yIFhtYkZpbGUuXHJcbiAgICAgKiBAcGFyYW0geG1sQ29udGVudCB0aGUgZmlsZSBjb250ZW50XHJcbiAgICAgKiBAcGFyYW0gcGF0aCB0aGUgcGF0aCBvZiB0aGUgZmlsZSAob25seSB1c2VkIHRvIHJlbWVtYmVyIGl0KVxyXG4gICAgICogQHBhcmFtIGVuY29kaW5nIHV0Zi04LCAuLi4gdXNlZCB0byBwYXJzZSBYTUwuXHJcbiAgICAgKiBUaGlzIGlzIHJlYWQgZnJvbSB0aGUgZmlsZSwgYnV0IGlmIHlvdSBrbm93IGl0IGJlZm9yZSwgeW91IGNhbiBhdm9pZCByZWFkaW5nIHRoZSBmaWxlIHR3aWNlLlxyXG4gICAgICogQHBhcmFtIG9wdGlvbmFsTWFzdGVyIGluIGNhc2Ugb2YgeG1iIHRoZSBtYXN0ZXIgZmlsZSwgdGhhdCBjb250YWlucyB0aGUgb3JpZ2luYWwgdGV4dHMuXHJcbiAgICAgKiAodGhpcyBpcyB1c2VkIHRvIHN1cHBvcnQgc3RhdGUgaW5mb3MsIHRoYXQgYXJlIGJhc2VkIG9uIGNvbXBhcmluZyBvcmlnaW5hbCB3aXRoIHRyYW5zbGF0ZWQgdmVyc2lvbilcclxuICAgICAqIElnbm9yZWQgZm9yIG90aGVyIGZvcm1hdHMuXHJcbiAgICAgKiBAcmV0dXJuIGVpdGhlciBYbGlmZkZpbGUgb3IgWG1iRmlsZVxyXG4gICAgICovXHJcbiAgICBwdWJsaWMgc3RhdGljIGZyb21Vbmtub3duRm9ybWF0RmlsZUNvbnRlbnQoeG1sQ29udGVudDogc3RyaW5nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGF0aDogc3RyaW5nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZW5jb2Rpbmc6IHN0cmluZyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9wdGlvbmFsTWFzdGVyPzoge3htbENvbnRlbnQ6IHN0cmluZywgcGF0aDogc3RyaW5nLCBlbmNvZGluZzogc3RyaW5nfSk6IElUcmFuc2xhdGlvbk1lc3NhZ2VzRmlsZSB7XHJcbiAgICAgICAgcmV0dXJuIG5ldyBUcmFuc2xhdGlvbk1lc3NhZ2VzRmlsZUZhY3RvcnkoKS5jcmVhdGVGaWxlRnJvbVVua25vd25Gb3JtYXRGaWxlQ29udGVudCh4bWxDb250ZW50LCBwYXRoLCBlbmNvZGluZywgb3B0aW9uYWxNYXN0ZXIpO1xyXG4gICAgfVxyXG5cclxuICAgIC8qKlxyXG4gICAgICogUmVhZCBmaWxlIGZ1bmN0aW9uLCByZXN1bHQgZGVwZW5kcyBvbiBmb3JtYXQsIGVpdGhlciBYbGlmZkZpbGUgb3IgWG1iRmlsZS5cclxuICAgICAqIEBwYXJhbSBpMThuRm9ybWF0IGN1cnJlbnRseSAneGxmJyBvciAneGxmMicgb3IgJ3htYicgb3IgJ3h0YicgYXJlIHN1cHBvcnRlZFxyXG4gICAgICogQHBhcmFtIHhtbENvbnRlbnQgdGhlIGZpbGUgY29udGVudFxyXG4gICAgICogQHBhcmFtIHBhdGggdGhlIHBhdGggb2YgdGhlIGZpbGUgKG9ubHkgdXNlZCB0byByZW1lbWJlciBpdClcclxuICAgICAqIEBwYXJhbSBlbmNvZGluZyB1dGYtOCwgLi4uIHVzZWQgdG8gcGFyc2UgWE1MLlxyXG4gICAgICogVGhpcyBpcyByZWFkIGZyb20gdGhlIGZpbGUsIGJ1dCBpZiB5b3Uga25vdyBpdCBiZWZvcmUsIHlvdSBjYW4gYXZvaWQgcmVhZGluZyB0aGUgZmlsZSB0d2ljZS5cclxuICAgICAqIEBwYXJhbSBvcHRpb25hbE1hc3RlciBpbiBjYXNlIG9mIHhtYiB0aGUgbWFzdGVyIGZpbGUsIHRoYXQgY29udGFpbnMgdGhlIG9yaWdpbmFsIHRleHRzLlxyXG4gICAgICogKHRoaXMgaXMgdXNlZCB0byBzdXBwb3J0IHN0YXRlIGluZm9zLCB0aGF0IGFyZSBiYXNlZCBvbiBjb21wYXJpbmcgb3JpZ2luYWwgd2l0aCB0cmFuc2xhdGVkIHZlcnNpb24pXHJcbiAgICAgKiBJZ25vcmVkIGZvciBvdGhlciBmb3JtYXRzLlxyXG4gICAgICogQHJldHVybiBlaXRoZXIgWGxpZmZGaWxlIG9yIFhtYkZpbGVcclxuICAgICAqL1xyXG4gICAgY3JlYXRlRmlsZUZyb21GaWxlQ29udGVudChpMThuRm9ybWF0OiBzdHJpbmcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHhtbENvbnRlbnQ6IHN0cmluZyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGF0aDogc3RyaW5nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbmNvZGluZzogc3RyaW5nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25hbE1hc3Rlcj86IHsgeG1sQ29udGVudDogc3RyaW5nLCBwYXRoOiBzdHJpbmcsIGVuY29kaW5nOiBzdHJpbmcgfSk6IElUcmFuc2xhdGlvbk1lc3NhZ2VzRmlsZSB7XHJcbiAgICAgICAgaWYgKGkxOG5Gb3JtYXQgPT09IEZPUk1BVF9YTElGRjEyKSB7XHJcbiAgICAgICAgICAgIHJldHVybiBuZXcgWGxpZmZGaWxlKHhtbENvbnRlbnQsIHBhdGgsIGVuY29kaW5nLCBvcHRpb25hbE1hc3Rlcik7XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChpMThuRm9ybWF0ID09PSBGT1JNQVRfWExJRkYyMCkge1xyXG4gICAgICAgICAgICByZXR1cm4gbmV3IFhsaWZmMkZpbGUoeG1sQ29udGVudCwgcGF0aCwgZW5jb2RpbmcpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoaTE4bkZvcm1hdCA9PT0gRk9STUFUX1hNQikge1xyXG4gICAgICAgICAgICByZXR1cm4gbmV3IFhtYkZpbGUodGhpcywgeG1sQ29udGVudCwgcGF0aCwgZW5jb2RpbmcpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoaTE4bkZvcm1hdCA9PT0gRk9STUFUX1hUQikge1xyXG4gICAgICAgICAgICByZXR1cm4gbmV3IFh0YkZpbGUodGhpcywgeG1sQ29udGVudCwgcGF0aCwgZW5jb2RpbmcsIG9wdGlvbmFsTWFzdGVyKTtcclxuICAgICAgICB9XHJcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKGZvcm1hdCgnb29wcywgdW5zdXBwb3J0ZWQgZm9ybWF0IFwiJXNcIicsIGkxOG5Gb3JtYXQpKTtcclxuXHJcbiAgICB9XHJcblxyXG4gICAgLyoqXHJcbiAgICAgKiBSZWFkIGZpbGUgZnVuY3Rpb24gZm9yIGFueSBmaWxlIHdpdGggdW5rbm93biBmb3JtYXQuXHJcbiAgICAgKiBUaGlzIGZ1bmN0aW9ucyB0cmllcyB0byBndWVzcyB0aGUgZm9ybWF0IGJhc2VkIG9uIHRoZSBmaWxlbmFtZSBhbmQgdGhlIGNvbnRlbnQgb2YgdGhlIGZpbGUuXHJcbiAgICAgKiBSZXN1bHQgZGVwZW5kcyBvbiBkZXRlY3RlZCBmb3JtYXQsIGVpdGhlciBYbGlmZkZpbGUgb3IgWG1iRmlsZS5cclxuICAgICAqIEBwYXJhbSB4bWxDb250ZW50IHRoZSBmaWxlIGNvbnRlbnRcclxuICAgICAqIEBwYXJhbSBwYXRoIHRoZSBwYXRoIG9mIHRoZSBmaWxlIChvbmx5IHVzZWQgdG8gcmVtZW1iZXIgaXQpXHJcbiAgICAgKiBAcGFyYW0gZW5jb2RpbmcgdXRmLTgsIC4uLiB1c2VkIHRvIHBhcnNlIFhNTC5cclxuICAgICAqIFRoaXMgaXMgcmVhZCBmcm9tIHRoZSBmaWxlLCBidXQgaWYgeW91IGtub3cgaXQgYmVmb3JlLCB5b3UgY2FuIGF2b2lkIHJlYWRpbmcgdGhlIGZpbGUgdHdpY2UuXHJcbiAgICAgKiBAcGFyYW0gb3B0aW9uYWxNYXN0ZXIgaW4gY2FzZSBvZiB4bWIgdGhlIG1hc3RlciBmaWxlLCB0aGF0IGNvbnRhaW5zIHRoZSBvcmlnaW5hbCB0ZXh0cy5cclxuICAgICAqICh0aGlzIGlzIHVzZWQgdG8gc3VwcG9ydCBzdGF0ZSBpbmZvcywgdGhhdCBhcmUgYmFzZWQgb24gY29tcGFyaW5nIG9yaWdpbmFsIHdpdGggdHJhbnNsYXRlZCB2ZXJzaW9uKVxyXG4gICAgICogSWdub3JlZCBmb3Igb3RoZXIgZm9ybWF0cy5cclxuICAgICAqIEByZXR1cm4gZWl0aGVyIFhsaWZmRmlsZSBvciBYbWJGaWxlXHJcbiAgICAgKi9cclxuICAgIGNyZWF0ZUZpbGVGcm9tVW5rbm93bkZvcm1hdEZpbGVDb250ZW50KHhtbENvbnRlbnQ6IHN0cmluZyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHBhdGg6IHN0cmluZyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVuY29kaW5nOiBzdHJpbmcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25hbE1hc3Rlcj86IHsgeG1sQ29udGVudDogc3RyaW5nLCBwYXRoOiBzdHJpbmcsIGVuY29kaW5nOiBzdHJpbmcgfSlcclxuICAgICAgICA6IElUcmFuc2xhdGlvbk1lc3NhZ2VzRmlsZSB7XHJcbiAgICAgICAgbGV0IGZvcm1hdENhbmRpZGF0ZXMgPSBbRk9STUFUX1hMSUZGMTIsIEZPUk1BVF9YTElGRjIwLCBGT1JNQVRfWE1CLCBGT1JNQVRfWFRCXTtcclxuICAgICAgICBpZiAocGF0aCAmJiBwYXRoLmVuZHNXaXRoKCd4bWInKSkge1xyXG4gICAgICAgICAgICBmb3JtYXRDYW5kaWRhdGVzID0gW0ZPUk1BVF9YTUIsIEZPUk1BVF9YVEIsIEZPUk1BVF9YTElGRjEyLCBGT1JNQVRfWExJRkYyMF07XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChwYXRoICYmIHBhdGguZW5kc1dpdGgoJ3h0YicpKSB7XHJcbiAgICAgICAgICAgIGZvcm1hdENhbmRpZGF0ZXMgPSBbRk9STUFUX1hUQiwgRk9STUFUX1hNQiwgRk9STUFUX1hMSUZGMTIsIEZPUk1BVF9YTElGRjIwXTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gdHJ5IGFsbCBjYW5kaWRhdGUgZm9ybWF0cyB0byBnZXQgdGhlIHJpZ2h0IG9uZVxyXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZm9ybWF0Q2FuZGlkYXRlcy5sZW5ndGg7IGkrKykge1xyXG4gICAgICAgICAgICBjb25zdCBmb3JtYXRDYW5kaWRhdGUgPSBmb3JtYXRDYW5kaWRhdGVzW2ldO1xyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgICAgY29uc3QgdHJhbnNsYXRpb25GaWxlID0gVHJhbnNsYXRpb25NZXNzYWdlc0ZpbGVGYWN0b3J5LmZyb21GaWxlQ29udGVudChcclxuICAgICAgICAgICAgICAgICAgICBmb3JtYXRDYW5kaWRhdGUsIHhtbENvbnRlbnQsIHBhdGgsIGVuY29kaW5nLCBvcHRpb25hbE1hc3Rlcik7XHJcbiAgICAgICAgICAgICAgICBpZiAodHJhbnNsYXRpb25GaWxlKSB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRyYW5zbGF0aW9uRmlsZTtcclxuICAgICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSBjYXRjaCAoZSkge1xyXG4gICAgICAgICAgICAgICAgLy8gc2VhbXMgdG8gYmUgdGhlIHdyb25nIGZvcm1hdFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihmb3JtYXQoJ2NvdWxkIG5vdCBpZGVudGlmeSBmaWxlIGZvcm1hdCwgaXQgaXMgbmVpdGVyIFhMSUZGICgxLjIgb3IgMi4wKSBub3IgWE1CL1hUQicpKTtcclxuICAgIH1cclxuXHJcbn1cclxuXHJcbiJdfQ==