/**
 * Print page frame.
 * Desktop / iOS honour CSS `@page { margin }`, so the spacers collapse to 0 there.
 * Android WebView ignores @page margins, so on Android (html.android-print) the
 * repeating <thead>/<tfoot> spacers + side padding recreate the margin on every sheet.
 */
export default function PrintFrame({ children }) {
    return (
        <table className="print-frame">
            <thead>
                <tr><td><div className="print-frame-spacer" /></td></tr>
            </thead>
            <tbody>
                <tr><td className="print-frame-body">{children}</td></tr>
            </tbody>
            <tfoot>
                <tr><td><div className="print-frame-spacer" /></td></tr>
            </tfoot>
        </table>
    );
}
