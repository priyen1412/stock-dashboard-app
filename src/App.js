import React, { useState, useEffect } from 'react';
// import './index.css'; // This import is not needed for Tailwind CSS classes

function App() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Ensure the Google Sheet is published to CSV correctly.
    // The URL should end with &output=csv.
    const googleSheetCsvUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRUthUWDMj2uhp0KxFBlVTgryGTLYXZ6QnW6k6aRszmHk2MsHgIRlVP1981f7Zx_O2GrWNsH3wtB1_Q/pub?gid=223530344&single=true&output=csv';

    const fetchStockData = async () => {
      try {
        console.log("Attempting to fetch CSV data from:", googleSheetCsvUrl);
        const response = await fetch(googleSheetCsvUrl, {
          method: 'GET',
          mode: 'cors', // Use 'cors' mode for cross-origin requests
          headers: {
            'Accept': 'text/csv,text/plain,*/*', // Request CSV or plain text
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP error! Status: ${response.status}. This might be due to a temporary service issue or an incorrect URL/publishing setting. Response: ${errorText.substring(0, 200)}...`);
        }
        
        const csvText = await response.text();
        console.log("Fetched CSV Text (first 500 chars):", csvText.substring(0, 500) + "...");

        // Basic check to see if we got HTML instead of CSV
        if (csvText.includes('<html') || csvText.includes('<!DOCTYPE')) {
          throw new Error("Received HTML content instead of CSV data. Please ensure your Google Sheet is published as CSV.");
        }

        if (csvText.trim().length === 0) {
          throw new Error("Received empty CSV data. Please verify your Google Sheet has content and is published correctly.");
        }

        const parsedData = parseCsv(csvText);
        console.log("Parsed Data (after parseCsv):", parsedData);

        if (parsedData.length === 0) {
          throw new Error("No valid stock data found after parsing the CSV. Check headers (especially 'Symbol') and data rows in your Google Sheet.");
        }

        // Sort stocks by Liquidity in descending order
        const sortedStocks = parsedData.sort((a, b) => (b.Liquidity || 0) - (a.Liquidity || 0));
        setStocks(sortedStocks);

      } catch (err) {
        console.error("Failed to fetch or parse stock data:", err);
        setError(`Failed to load stock data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchStockData();
  }, []); // Empty dependency array means this effect runs once after the initial render

  // Function to parse CSV text into an array of objects
  const parseCsv = (csvText) => {
    const lines = csvText.split('\n');
    let headers = null;
    let headerStartIndex = -1;
    const data = [];

    // Skip leading empty lines and find the header row
    // The header row is expected to contain 'Symbol'
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.length > 0) {
        // Simple check to see if the first non-empty line contains 'Symbol'
        const parts = line.split(',').filter(part => part.trim().length > 0);
        if (parts.length > 0 && parts[0].toLowerCase().includes('symbol')) { // Use includes for more robust header detection
          headers = line.split(',').map(header => {
            header = header.trim().replace(/^"|"$/g, ''); // Remove quotes around headers
            // Map header names to a more consistent format for object keys (e.g., "Percent Change" -> "Percent_change")
            return header.replace(/ /g, '_');
          });
          headerStartIndex = i;
          break;
        }
      }
    }

    if (!headers) {
      console.warn("No header row found containing 'Symbol'. Please ensure your CSV has a 'Symbol' column.");
      return [];
    }
    console.log("Detected Headers:", headers);

    // Process data rows starting from the line after the headers
    for (let i = headerStartIndex + 1; i < lines.length; i++) {
      let line = lines[i].trim();
      if (line.length > 0) {
        const values = [];
        let currentValue = "";
        let inQuotes = false;

        // Custom CSV parsing logic to handle commas within quoted fields
        for (let j = 0; j < line.length; j++) {
          const char = line[j];

          if (char === '"') {
            inQuotes = !inQuotes; // Toggle quote status
          } else if (char === ',' && !inQuotes) {
            values.push(currentValue.trim());
            currentValue = "";
          } else {
            currentValue += char;
          }
        }
        values.push(currentValue.trim()); // Add the last value

        // Ensure the number of values matches the number of headers
        if (values.length === headers.length) {
          const row = {};
          for (let j = 0; j < headers.length; j++) {
            let value = values[j];

            // Remove leading/trailing quotes from values
            value = value.replace(/^"|"$/g, '');

            // Type parsing for specific columns
            if (headers[j] === 'Current_price' || headers[j] === 'Price_change' || headers[j] === 'Liquidity' || headers[j] === 'Volume') {
              // Remove commas from numbers (e.g., "1,234.56" -> "1234.56")
              value = parseFloat(value.replace(/,/g, '')) || 0;
            }
            if (headers[j] === 'Percent_change') {
              value = parseFloat(value) || 0; // Parse percentage directly
            }

            row[headers[j]] = value;
          }
          // Only add row if it has a Symbol
          if (row.Symbol && row.Symbol.length > 0) {
            data.push(row);
          } else {
            console.warn(`Skipping row ${i + 1} due to missing or empty 'Symbol'. Line: ${line}`);
          }
        } else {
          console.warn(`Skipping row ${i + 1} due to column count mismatch. Headers: ${headers.length}, Values: ${values.length}. Line: ${line}`);
        }
      }
    }

    console.log("Final data array size before return:", data.length);
    if (data.length === 0) {
      console.warn("No data rows found after the header, or all data rows were skipped.");
    }
    return data;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100 font-inter">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-2xl font-semibold text-blue-800">Loading stock data... 🚀</p>
          <p className="mt-2 text-gray-600">Please ensure your Google Sheet is published correctly as CSV.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4 font-inter">
        <div className="rounded-2xl bg-red-50 p-8 text-center shadow-xl max-w-3xl border border-red-200">
          <p className="mb-4 text-2xl font-extrabold text-red-800">Oops! Something went wrong. 🚨</p>
          <p className="mb-6 text-lg text-red-700 break-words">Error: {error}</p>
          <div className="text-sm text-gray-800 text-left bg-white p-6 rounded-xl mt-6 shadow-inner border border-gray-100">
            <p className="mb-3 font-bold text-gray-900 text-base">Here are some common fixes and checks:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Ensure your Google Sheet is published as <strong>CSV</strong> (not HTML or any other format). Go to File &gt; Share &gt; Publish to web &gt; Choose CSV.</li>
              <li>The URL in the code should explicitly contain <code className="bg-gray-200 px-2 py-1 rounded-md font-mono text-blue-700">output=csv</code> at the end.</li>
              <li>Verify that the Google Sheet's sharing settings are "Anyone with the link can view".</li>
              <li>Check that your column headers in the Google Sheet exactly match the expected names (case-insensitive where reasonable, but exact match is safest):
                <ul className="list-disc list-inside ml-5 mt-1 space-y-0.5 text-gray-700">
                  <li><code className="bg-gray-200 px-1 rounded-sm">Symbol</code> (Mandatory for each stock)</li>
                  <li><code className="bg-gray-200 px-1 rounded-sm">Exchange</code> (Optional)</li>
                  <li><code className="bg-gray-200 px-1 rounded-sm">Stock name</code></li>
                  <li><code className="bg-gray-200 px-1 rounded-sm">Current price</code></li>
                  <li><code className="bg-gray-200 px-1 rounded-sm">Percent_change</code> or <code className="bg-gray-200 px-1 rounded-sm">% change</code></li>
                  <li><code className="bg-gray-200 px-1 rounded-sm">Liquidity</code></li>
                  <li><code className="bg-gray-200 px-1 rounded-sm">Volume</code></li>
                </ul>
              </li>
              <li>Make sure the 'Symbol' column is populated for all rows you intend to display. Empty symbols will be skipped.</li>
            </ul>
            <p className="mt-4 text-xs text-gray-500 italic">For more specific technical debugging information, please check your browser's developer console.</p>
          </div>
        </div>
      </div>
    );
  }

  if (stocks.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-100 p-4 font-inter">
        <div className="rounded-2xl bg-yellow-50 p-8 text-center shadow-xl max-w-2xl border border-yellow-200">
          <p className="mb-4 text-2xl font-extrabold text-yellow-800">No Stock Data Found 🧐</p>
          <p className="text-lg text-gray-700 leading-relaxed">
            The CSV file was successfully fetched, but after processing, no valid stock entries were identified.
            This might be due to a few reasons:
          </p>
          <ul className="list-disc list-inside text-left mx-auto max-w-md mt-4 space-y-2 text-gray-700">
            <li>All rows might be missing a value in the <code className="bg-gray-200 px-1 rounded-sm">Symbol</code> column.</li>
            <li>The header row itself might be missing or incorrectly formatted.</li>
            <li>All data rows might have been skipped due to mismatches in column count or other parsing issues.</li>
          </ul>
          <p className="mt-6 text-sm text-gray-600 italic">Please carefully verify your Google Sheet's content, especially the 'Symbol' column and the header row. Check browser console logs for details on any skipped rows during parsing.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 font-inter antialiased">
      <header className="mb-10 text-center py-8 bg-gradient-to-r from-blue-50 to-purple-50 rounded-b-3xl shadow-lg">
        <h1 className="text-5xl font-extrabold text-gray-900 drop-shadow-md sm:text-6xl md:text-7xl">
          <span className="bg-gradient-to-r from-blue-600 via-purple-500 to-pink-500 bg-clip-text text-transparent">
            Live Stock Liquidity Dashboard
          </span>
        </h1>
        <p className="mt-5 text-xl text-gray-700 sm:text-2xl max-w-2xl mx-auto">
          Displaying stocks sorted by their <strong className="text-purple-600">liquidity</strong>, fetched dynamically from your Google Sheet! 📈📊
        </p>
        <p className="mt-3 text-sm text-gray-600">
          A total of <strong className="text-blue-500">{stocks.length}</strong> stock entries loaded successfully.
        </p>
      </header>
      <main className="container mx-auto px-4">
        <div className="grid gap-8 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {stocks.map((stock) => {
            // Ensure stock.Symbol is a string or fallback to a unique ID for the key
            const uniqueKey = stock.Symbol || `stock-${Math.random().toString(36).substr(2, 9)}`;
            const percentChangeClass = (stock.Percent_change || 0) >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
            const priceChangeClass = (stock.Price_change || 0) >= 0 ? 'text-green-600' : 'text-red-600';

            return (
              <div
                key={uniqueKey}
                className="transform cursor-pointer rounded-3xl bg-white p-7 shadow-xl transition-all duration-300 ease-in-out hover:scale-105 hover:shadow-2xl hover:border-blue-300 border border-transparent"
              >
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-3xl font-bold text-gray-800">
                    {stock.Symbol || 'N/A'}
                  </h2>
                  <span className={`rounded-full px-4 py-1.5 text-base font-semibold ${percentChangeClass} flex items-center`}>
                    {(stock.Percent_change || 0) >= 0 ? '▲ ' : '▼ '}
                    {(stock.Percent_change || 0).toFixed(2)}%
                  </span>
                </div>
                <p className="mb-3 text-lg text-gray-600">
                  <span className="font-medium text-gray-800">Stock Name:</span> {stock.Stock_name || 'N/A'}
                </p>
                <p className="mb-4 text-4xl font-extrabold text-blue-700 tracking-tight">
                  ₹{(stock.Current_price || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-gray-700">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-500">Price Change:</span>
                    <span className={`text-xl font-semibold ${priceChangeClass}`}>
                      {(stock.Price_change || 0) >= 0 ? '+' : ''}{(stock.Price_change || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-500">Liquidity (M):</span>
                    <span className="text-xl font-semibold text-purple-600">
                      {(stock.Liquidity || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M
                    </span>
                  </div>
                  <div className="col-span-2 flex flex-col">
                    <span className="text-sm font-medium text-gray-500">Volume (M):</span>
                    <span className="text-xl font-semibold text-indigo-600">
                      {(stock.Volume || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}M
                    </span>
                  </div>
                </div>
                {stock.Exchange && (
                  <div className="mt-4 text-xs text-gray-500 pt-3 border-t border-gray-100">
                    <span className="font-medium">Exchange:</span> {stock.Exchange}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </main>
      <footer className="mt-16 text-center text-gray-600 py-6 border-t border-gray-200">
        <p className="text-sm">&copy; 2025 Live Stock Liquidity Dashboard. All rights reserved.</p>
        <p className="text-xs mt-1">Data fetched from Google Sheets. Real-time updates may vary based on sheet refresh.</p>
      </footer>
    </div>
  );
}

export default App;
