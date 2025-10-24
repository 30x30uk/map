# Run locally
`python -m http.server`

Access localhost:8000

# Python setup 

python3 -m venv .venv          # one-time
source .venv/bin/activate      # every new shell
pip install -r requirements.txt


# To run the script to copy Airtable projects to local json

cd data/
export AT_BASE_ID="xxx"
export AT_TOKEN="xxx"
export OUT_FILE=all.json
python3 airtable_projects_to_json.py
