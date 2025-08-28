#!/usr/bin/env python3
"""
Demo script to test the DICOM Viewer application
"""

import requests
import time
import os
import sys

def test_backend():
    """Test if the backend is running and responsive"""
    try:
        response = requests.get("http://localhost:8000/", timeout=5)
        if response.status_code == 200:
            print("✅ Backend is running and responsive")
            return True
        else:
            print(f"❌ Backend returned status code: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Backend is not accessible: {e}")
        return False

def test_frontend():
    """Test if the frontend is running and responsive"""
    try:
        response = requests.get("http://localhost:3000/", timeout=5)
        if response.status_code == 200:
            print("✅ Frontend is running and responsive")
            return True
        else:
            print(f"❌ Frontend returned status code: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ Frontend is not accessible: {e}")
        return False

def test_api_endpoints():
    """Test API endpoints"""
    try:
        # Test sessions endpoint
        response = requests.get("http://localhost:8000/api/sessions", timeout=5)
        if response.status_code == 200:
            print("✅ API sessions endpoint is working")
        else:
            print(f"❌ API sessions endpoint returned status code: {response.status_code}")
            return False

        # Test API docs
        response = requests.get("http://localhost:8000/docs", timeout=5)
        if response.status_code == 200:
            print("✅ API documentation is accessible")
        else:
            print(f"❌ API documentation returned status code: {response.status_code}")
            return False

        return True
    except requests.exceptions.RequestException as e:
        print(f"❌ API endpoints test failed: {e}")
        return False

def main():
    print("🧪 DICOM Viewer Demo Test")
    print("=" * 30)
    
    # Test backend
    print("\n🔧 Testing Backend...")
    backend_ok = test_backend()
    
    # Test frontend
    print("\n🎨 Testing Frontend...")
    frontend_ok = test_frontend()
    
    # Test API endpoints
    print("\n📡 Testing API Endpoints...")
    api_ok = test_api_endpoints()
    
    # Summary
    print("\n📊 Test Summary:")
    print("=" * 30)
    print(f"Backend: {'✅ PASS' if backend_ok else '❌ FAIL'}")
    print(f"Frontend: {'✅ PASS' if frontend_ok else '❌ FAIL'}")
    print(f"API Endpoints: {'✅ PASS' if api_ok else '❌ FAIL'}")
    
    if backend_ok and frontend_ok and api_ok:
        print("\n🎉 All tests passed! The DICOM Viewer is ready to use.")
        print("\n📋 Next steps:")
        print("1. Open http://localhost:3000 in your browser")
        print("2. Upload ZIP files containing DICOM data")
        print("3. Explore the 2D and 3D visualization features")
        print("4. Check the API documentation at http://localhost:8000/docs")
    else:
        print("\n❌ Some tests failed. Please check the server logs and try again.")
        sys.exit(1)

if __name__ == "__main__":
    main()
