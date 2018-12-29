import React from "react";
import Select from "react-select";
import { GitHubApolloClientContext } from "./GithubApolloClientContext";
import {
  GetViewerReposComponent,
  GetViewerReposEdges,
} from "./github-apollo-components";

interface Props {
  onChange: (data: GetViewerReposEdges | null) => void;
}

const itemToString = (x: GetViewerReposEdges) => (x ? x.node!.name : "");

export class RepoAutoComplete extends React.Component<Props> {
  static contextType = GitHubApolloClientContext;

  render() {
    const { onChange } = this.props;

    return (
      <GetViewerReposComponent client={this.context}>
        {({ data }) => (
          <Select
            onChange={x => {
              onChange(x ? (x as any).value : null);
            }}
            isSearchable
            isClearable
            options={
              data && data.viewer && data.viewer.repositories.edges
                ? data.viewer.repositories.edges.map(x => ({
                    value: x,
                    label: itemToString(x),
                  }))
                : []
            }
          />
        )}
      </GetViewerReposComponent>
    );
  }
}
