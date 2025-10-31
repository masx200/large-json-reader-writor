# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the `@masx200/large-json-reader-writor` npm package - a specialized Node.js module for handling large JSON files that exceed memory limits through chunked processing techniques. The project provides both programmatic APIs and command-line tools for downloading, reading, writing, and browsing large JSON files.

## Common Development Commands

### Running Examples and Tools
```bash
# Run the basic usage example
node example.js

# Run the browser example
node browser-example.js

# Use simple browser for basic JSON structure analysis
node simple-browser.js

# Launch interactive browser (requires file argument)
node interactive-browser.js path/to/large-file.json
```

### Package Management
```bash
# Install dependencies
npm install

# Install globally for CLI usage
npm install -g .
```

## Architecture Overview

### Core Processing Engine (`index.js`)
The `LargeJSONHandler` class is the heart of the system with these key methods:
- `downloadJSON(url, outputPath, options)` - Stream downloads JSON from HTTP/HTTPS URLs
- `readJSONInChunks(filePath, options)` - Reads JSON in configurable chunks (default 500 chars)
- `writeJSONInChunks(data, outputPath, options)` - Writes JSON in chunks to avoid memory overflow
- `findPreviousBracket()` / `findNextBracket()` - Utility methods for JSON boundary detection

### Browser Layer Architecture
Three specialized browsers serve different use cases:
- **simple-browser.js** - Basic structure analysis, key extraction, simple search
- **json-browser.js** - Advanced structure analysis with path navigation, comprehensive search
- **json-parser.js** - Streaming parser for path-based data extraction

### Interactive Shell (`interactive-browser.js`)
Provides command-line interface with commands:
- `help` - Show available commands
- `cd <path>` - Navigate using dot notation (`info.title`) or array indexing (`paths[0]`)
- `ls` - List current level properties
- `cat <path>` - Display value at path
- `search <query>` - Search for keys or values
- `tree [depth]` - Display JSON structure tree

## Key Development Patterns

### Memory-Conscious Design
- Always use chunked processing (default 500 characters) to prevent memory overflow
- Implement automatic buffer cleanup after processing large chunks
- Use progress callbacks for all operations to monitor processing

### Error Handling Strategy
- Implement graceful degradation - continue processing even if individual chunks fail
- Always validate JSON snippets before processing with `validateJSONSnippet()`
- Use boundary detection methods to find complete JSON objects within chunks

### Performance Considerations
- Leverage Node.js streams for efficient I/O operations
- Implement early termination when enough data is gathered
- Use selective parsing to avoid processing entire large files

## Configuration Options

### Chunk Processing Configuration
```javascript
const handler = new LargeJSONHandler();
// or configure with custom options
const browser = new SimpleJSONBrowser({
    maxChunkSize: 500  // Adjust processing unit size
});
```

### Read/Write Options
```javascript
await handler.readJSONInChunks('./file.json', {
    chunkSize: 1000,        // Custom chunk size
    pretty: true,          // Pretty print output
    progressCallback: (pos, total) => console.log(`Progress: ${(pos/total*100).toFixed(1)}%`)
});
```

## Project Structure Notes

- All files are ES modules (package.json `"type": "module"`)
- No build process required - uses plain JavaScript
- Core logic is modular and reusable across different interfaces
- Each browser implementation serves specific use cases without code duplication
- TypeScript definitions available via @types/node dependency

## Testing Validation

The tool has been tested with a 221.29 KB OpenAPI file containing:
- 7,490 keys
- 4,226 objects
- 260 arrays
- 10,581 strings
- 588 numbers
- 437 booleans
- 59 null values

When making changes, ensure they work with files of this scale and complexity.