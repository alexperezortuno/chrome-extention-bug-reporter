# chrome-extention-bug-reporter

The Smart Bug Reporter extension helps developers, QA teams, and product testers collect complete diagnostic data from any webpage in seconds.

Whether you’re debugging a staging environment, verifying a live application, or supporting customers, this tool automatically gathers everything your backend and frontend teams need to reproduce and resolve issues efficiently.

🚀 Key Features

• One-click bug reporting: Generate a complete report for the current tab instantly.
• Automatic screenshot capture: Takes a snapshot of the visible area of the webpage.
• Console log tracking: Records all messages, warnings, errors, and exceptions produced by the site’s JavaScript console.
• Network request logging: Monitors all HTTP and WebSocket activity during the capture period.
• Storage and cookies dump: Collects localStorage, sessionStorage, and cookies for the current domain to help reproduce session-related bugs.
• Metadata report: Includes browser, platform, and timestamp information for full traceability.
• Automatic ZIP packaging: All information is compressed into a single .zip file ready to share with your development or QA team.
• Upload or download: Option to automatically upload the ZIP report to your issue tracker or backend endpoint, or download it locally for manual review.

🧩 Typical Use Cases

• Internal QA and bug reporting.
• Frontend error tracking and regression testing.
• Support teams reproducing customer issues.
• Web developers debugging production or staging websites.

🔐 Privacy and Security

Smart Bug Reporter runs entirely on your local browser and does not collect or share data automatically.
Reports are generated only when you manually trigger them.
You can configure whether the generated ZIP file is downloaded locally or securely uploaded to your own server endpoint.

All collected information is visible to you before it leaves your computer, ensuring transparency and control.

🛠️ Technical Details

• Built with Manifest V3 for modern Chrome security compliance.
• Uses the Chrome Debugger API to capture network and console information safely.
• Compatible with any HTTPS or HTTP site.
• Works on Windows, macOS, Linux, and ChromeOS.

Disclaimer:
This extension is designed for debugging and quality assurance purposes only.
Users are responsible for handling and transmitting collected data according to their organization’s privacy and security policies.