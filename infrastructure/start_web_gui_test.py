#!/usr/bin/env python3
"""
Test server startup script for Web GUI testing
Starts the Flask web GUI on a test port for Playwright tests
"""

import os
import sys
import threading
import time
from web_gui import app

def start_test_server(port=8000, host='127.0.0.1'):
    """Start the Flask app in test mode"""
    print(f"🌐 Starting Web GUI test server on http://{host}:{port}")
    
    # Set test environment
    os.environ['FLASK_ENV'] = 'testing'
    app.config['TESTING'] = True
    app.config['WTF_CSRF_ENABLED'] = False  # Disable CSRF for testing
    
    try:
        app.run(host=host, port=port, debug=False, use_reloader=False)
    except Exception as e:
        print(f"❌ Failed to start server: {e}")
        sys.exit(1)

def start_server_background(port=8000, host='127.0.0.1'):
    """Start server in background thread for testing"""
    server_thread = threading.Thread(
        target=start_test_server,
        args=(port, host),
        daemon=True
    )
    server_thread.start()
    
    # Wait for server to start
    time.sleep(2)
    
    # Test if server is running
    import requests
    try:
        response = requests.get(f'http://{host}:{port}', timeout=5)
        print(f"✅ Test server is running and responding (status: {response.status_code})")
        return True
    except requests.exceptions.RequestException as e:
        print(f"❌ Test server failed to start properly: {e}")
        return False

if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Start Web GUI test server')
    parser.add_argument('--port', type=int, default=8000, help='Port to run on (default: 8000)')
    parser.add_argument('--host', default='127.0.0.1', help='Host to bind to (default: 127.0.0.1)')
    parser.add_argument('--background', action='store_true', help='Start in background for testing')
    
    args = parser.parse_args()
    
    if args.background:
        if start_server_background(args.port, args.host):
            print("🎯 Server started successfully in background")
            # Keep main thread alive
            try:
                while True:
                    time.sleep(1)
            except KeyboardInterrupt:
                print("\n🛑 Shutting down test server")
        else:
            sys.exit(1)
    else:
        start_test_server(args.port, args.host)
