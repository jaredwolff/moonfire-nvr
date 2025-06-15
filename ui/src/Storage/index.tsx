// This file is part of Moonfire NVR, a security camera network video recorder.
// Copyright (C) 2024 The Moonfire NVR Authors; see AUTHORS and LICENSE.txt.
// SPDX-License-Identifier: GPL-v3.0-or-later WITH GPL-3.0-linking-exception

import Alert from "@mui/material/Alert";
import Paper from "@mui/material/Paper";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Skeleton from "@mui/material/Skeleton";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow, { TableRowProps } from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import { useEffect, useState } from "react";
import * as api from "../api";
import { FrameProps } from "../App";
import AddIcon from "@mui/icons-material/Add";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import StorageIcon from "@mui/icons-material/Storage";
import IconButton from "@mui/material/IconButton";
import DeleteDialog from "./DeleteDialog";
import AddDialog from "./AddDialog";

import React from "react";
import { useSnackbars } from "../snackbars";

interface Props {
  Frame: (props: FrameProps) => JSX.Element;
  csrf?: string;
}

interface RowProps extends TableRowProps {
  path: React.ReactNode;
  usage: React.ReactNode;
  streams: React.ReactNode;
  status: React.ReactNode;
  gutter?: React.ReactNode;
}

/// More menu attached to a particular storage directory row.
interface More {
  storageDir: api.StorageDir;
  anchor: HTMLElement;
}

const Row = ({
  path,
  usage,
  streams,
  status,
  gutter,
  ...rest
}: RowProps) => (
  <TableRow {...rest}>
    <TableCell>{path}</TableCell>
    <TableCell>{usage}</TableCell>
    <TableCell>{streams}</TableCell>
    <TableCell>{status}</TableCell>
    <TableCell>{gutter}</TableCell>
  </TableRow>
);

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

const formatDuration = (duration90k: number): string => {
  const seconds = duration90k / 90000;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
};

const UsageDisplay = ({ storageDir }: { storageDir: api.StorageDir }) => {
  const usagePercent = storageDir.totalBytes > 0
    ? (storageDir.usedBytes / storageDir.totalBytes) * 100
    : 0;

  const getUsageColor = (percent: number) => {
    if (percent > 90) return "error";
    if (percent > 75) return "warning";
    return "primary";
  };

  return (
    <Box sx={{ minWidth: 200 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
        <Typography variant="body2">
          {formatBytes(storageDir.usedBytes)} / {formatBytes(storageDir.totalBytes)}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {usagePercent.toFixed(1)}%
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={usagePercent}
        color={getUsageColor(usagePercent)}
        sx={{ height: 8, borderRadius: 4 }}
      />
    </Box>
  );
};

const StreamsList = ({ streams }: { streams: api.StorageStreamUsage[] }) => (
  <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
    {streams.length === 0 ? (
      <Typography variant="body2" color="text.secondary">
        No streams
      </Typography>
    ) : (
      streams.map((stream, index) => (
        <Box key={index} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Chip
            label={`${stream.cameraName} (${stream.streamType})`}
            size="small"
            variant="outlined"
          />
          <Typography variant="caption" color="text.secondary">
            {formatBytes(stream.usedBytes)} • {formatDuration(stream.duration90k)}
          </Typography>
        </Box>
      ))
    )}
  </Box>
);

const StatusDisplay = ({ storageDir }: { storageDir: api.StorageDir }) => {
  const usagePercent = storageDir.totalBytes > 0
    ? (storageDir.usedBytes / storageDir.totalBytes) * 100
    : 0;

  if (storageDir.totalBytes === 0) {
    return <Chip label="Inaccessible" size="small" color="error" />;
  }

  if (usagePercent > 95) {
    return <Chip label="Full" size="small" color="error" />;
  } else if (usagePercent > 85) {
    return <Chip label="High Usage" size="small" color="warning" />;
  } else if (storageDir.streamsUsing.length > 0) {
    return <Chip label="Active" size="small" color="success" />;
  } else {
    return <Chip label="Available" size="small" color="info" />;
  }
};

const Main = ({ Frame, csrf }: Props) => {
  const [storage, setStorage] = useState<
    api.FetchResult<api.StorageResponse> | undefined
  >();
  const [more, setMore] = useState<undefined | More>();
  const [fetchSeq, setFetchSeq] = useState(0);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [deleteStorageDir, setDeleteStorageDir] = useState<
    undefined | api.StorageDir
  >();
  const snackbars = useSnackbars();

  const refetch = () => setFetchSeq((s) => s + 1);

  useEffect(() => {
    const abort = new AbortController();
    const doFetch = async (signal: AbortSignal) => {
      setStorage(await api.storage({ signal }));
    };
    doFetch(abort.signal);
    return () => {
      abort.abort();
    };
  }, [fetchSeq]);

  return (
    <Frame>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <Row
              path="Storage Directory"
              usage="Usage"
              streams="Streams"
              status="Status"
              gutter={
                <Tooltip title="Add storage directory">
                  <IconButton
                    aria-label="add"
                    onClick={() => setAddDialogOpen(true)}
                  >
                    <AddIcon />
                  </IconButton>
                </Tooltip>
              }
            />
          </TableHead>
          <TableBody>
            {storage === undefined && (
              <Row
                role="progressbar"
                path={<Skeleton />}
                usage={<Skeleton />}
                streams={<Skeleton />}
                status={<Skeleton />}
              />
            )}
            {storage?.status === "error" && (
              <TableRow>
                <TableCell colSpan={5}>
                  <Alert severity="error">{storage.message}</Alert>
                </TableCell>
              </TableRow>
            )}
            {storage?.status === "success" &&
              storage.response.storageDirs.map((dir: api.StorageDir) => (
                <Row
                  key={dir.id}
                  path={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <StorageIcon color="action" />
                      <Box>
                        <Typography variant="body2" fontWeight="medium">
                          {dir.path}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ID: {dir.id} • UUID: {dir.uuid.slice(0, 8)}...
                        </Typography>
                      </Box>
                    </Box>
                  }
                  usage={<UsageDisplay storageDir={dir} />}
                  streams={<StreamsList streams={dir.streamsUsing} />}
                  status={<StatusDisplay storageDir={dir} />}
                  gutter={
                    <IconButton
                      aria-label="more"
                      onClick={(e) =>
                        setMore({
                          storageDir: dir,
                          anchor: e.currentTarget,
                        })
                      }
                    >
                      <MoreVertIcon />
                    </IconButton>
                  }
                />
              ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Menu
        anchorEl={more?.anchor}
        open={more !== undefined}
        onClose={() => setMore(undefined)}
      >
        <MenuItem
          onClick={() => {
            setDeleteStorageDir(more?.storageDir);
            setMore(undefined);
          }}
          disabled={more?.storageDir.streamsUsing.length > 0}
        >
          <Typography
            color={more?.storageDir.streamsUsing.length > 0 ? "text.disabled" : "error"}
          >
            Delete
          </Typography>
        </MenuItem>
      </Menu>
      <AddDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onSuccess={refetch}
        csrf={csrf}
      />
      <DeleteDialog
        storageDir={deleteStorageDir}
        onClose={() => setDeleteStorageDir(undefined)}
        onSuccess={refetch}
        csrf={csrf}
      />
    </Frame>
  );
};

export default Main;
