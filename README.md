# Kusama Overview

> Validators explorer for [Kusama Network](https://kusama.network/)

![Preview image](preview.png)

## Getting Started
These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

Application uses [MongoDB](https://www.mongodb.com/) and [Node.js](https://nodejs.org). It need to be installed first before continue.

### Installation

```
# Clone this repo to your local machine
git clone https://github.com/genesis-lab-team/kusama-overview.git


# Install dependencies

cd kusama-overview
npm ci

cd parser-light
npm ci

cd ../api
npm ci

cd ../ui
npm ci


# Set .env configuration

cd ../parser-light
cp .env.example .env

cd ../api
cp .env.example .env

cd ../ui
cp .env.example .env


# Start the application in development mode

cd ..
npm run dev


# You can see the application running by visiting http://127.0.0.1:3001 url in your browser
```
